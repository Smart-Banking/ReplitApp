document.addEventListener('DOMContentLoaded', () => {
    // Initialize Feather icons
    feather.replace();

    // DOM Elements
    const cameraBtn = document.getElementById('camera-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const cameraContainer = document.getElementById('camera-container');
    const cameraView = document.getElementById('camera-view');
    const captureBtn = document.getElementById('capture-btn');
    const cancelCameraBtn = document.getElementById('cancel-camera-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const processBtn = document.getElementById('process-btn');
    const ocrResult = document.getElementById('ocr-result');
    const ocrLoading = document.getElementById('ocr-loading');
    const extractedText = document.getElementById('extracted-text');
    const aiPrompt = document.getElementById('ai-prompt');
    const promptText = document.getElementById('prompt-text');
    const analyzeBtn = document.getElementById('analyze-btn');
    const aiResult = document.getElementById('ai-result');
    const aiLoading = document.getElementById('ai-loading');
    const aiResponse = document.getElementById('ai-response');
    const newScanBtn = document.getElementById('new-scan-btn');

    // OpenAI client initialization will happen later when analyzing with AI
    let openai = null;

    // Variables to store data
    let stream = null;
    let capturedImage = null;

    // Event Listeners
    cameraBtn.addEventListener('click', startCamera);
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    captureBtn.addEventListener('click', capturePhoto);
    cancelCameraBtn.addEventListener('click', stopCamera);
    retakeBtn.addEventListener('click', resetImageCapture);
    processBtn.addEventListener('click', processImage);
    analyzeBtn.addEventListener('click', analyzeWithAI);
    newScanBtn.addEventListener('click', resetAll);

    // Initialize Tesseract worker
    const worker = Tesseract.createWorker({
        logger: message => {
            if (message.status === 'recognizing text') {
                // Could update a progress bar here
                console.log(`OCR Progress: ${(message.progress * 100).toFixed(1)}%`);
            }
        }
    });

    /**
     * Starts the camera stream
     */
    async function startCamera() {
        try {
            // Request camera permissions and get stream
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            
            // Set the stream as the video source
            cameraView.srcObject = stream;
            
            // Show camera container, hide other elements
            cameraContainer.classList.remove('hidden');
            previewContainer.classList.add('hidden');
            
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Грешка при достъп до камерата. Моля, уверете се, че сте разрешили достъпа до камерата.');
        }
    }

    /**
     * Stops the camera stream
     */
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraContainer.classList.add('hidden');
    }

    /**
     * Captures a photo from the camera stream
     */
    function capturePhoto() {
        // Create a canvas element to capture the frame
        const canvas = document.createElement('canvas');
        canvas.width = cameraView.videoWidth;
        canvas.height = cameraView.videoHeight;
        
        // Draw the current video frame to the canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraView, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to data URL
        capturedImage = canvas.toDataURL('image/jpeg');
        
        // Set the preview image src
        previewImage.src = capturedImage;
        
        // Show preview, hide camera
        previewContainer.classList.remove('hidden');
        cameraContainer.classList.add('hidden');
        
        // Stop camera stream
        stopCamera();
    }

    /**
     * Handles file upload from the user
     */
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Check if the file is an image
        if (!file.type.match('image.*')) {
            alert('Моля, изберете файл с изображение.');
            return;
        }
        
        // Create a FileReader to read the image
        const reader = new FileReader();
        reader.onload = function(event) {
            capturedImage = event.target.result;
            previewImage.src = capturedImage;
            previewContainer.classList.remove('hidden');
        };
        
        reader.readAsDataURL(file);
    }

    /**
     * Resets the image capture view
     */
    function resetImageCapture() {
        previewContainer.classList.add('hidden');
        capturedImage = null;
        previewImage.src = '';
        fileInput.value = '';
    }

    /**
     * Processes the captured image with OCR
     */
    async function processImage() {
        if (!capturedImage) {
            alert('Моля, първо заснемете или качете изображение.');
            return;
        }
        
        // Show OCR loading spinner
        ocrLoading.classList.remove('hidden');
        ocrResult.classList.remove('hidden');
        
        try {
            // Initialize the worker
            await worker.load();
            await worker.loadLanguage('bul');
            await worker.initialize('bul');
            
            // Run OCR on the captured image
            const result = await worker.recognize(capturedImage);
            
            // Set the extracted text
            extractedText.value = result.data.text;
            
            // Terminate the worker to free memory
            await worker.terminate();
            
            // Hide loading spinner, show AI prompt section
            ocrLoading.classList.add('hidden');
            aiPrompt.classList.remove('hidden');
            
            // Set default prompt if empty
            if (!promptText.value) {
                promptText.value = 'Моля, обобщи тази касова бележка и ми кажи колко е общата сума.';
            }
            
        } catch (error) {
            console.error('OCR Error:', error);
            ocrLoading.classList.add('hidden');
            alert('Грешка при обработка на изображението. Моля, опитайте отново с по-ясна снимка.');
        }
    }

    /**
     * Analyzes the extracted text with OpenAI
     */
    async function analyzeWithAI() {
        const text = extractedText.value;
        const prompt = promptText.value;
        
        if (!text || !prompt) {
            alert('Моля, уверете се, че и текстът, и въпросът са попълнени.');
            return;
        }
        
        // Show AI results section and loading spinner
        aiResult.classList.remove('hidden');
        aiLoading.classList.remove('hidden');
        
        try {
            // Get the API key from environment or use a default for testing
            // In a production environment, you'd get this from a secure source
            // This will be replaced with the actual API key from environment variables
            const apiKey = getApiKey();
            
            if (!apiKey) {
                throw new Error('OpenAI API ключът не е наличен.');
            }
            
            // Use the OpenAI global object from the CDN
            if (typeof OpenAI === 'undefined') {
                throw new Error('OpenAI библиотеката не е заредена правилно.');
            }
            
            // Initialize the OpenAI client
            openai = new OpenAI({ 
                apiKey: apiKey,
                dangerouslyAllowBrowser: true
            });
            
            const finalPrompt = `Анализирай следния текст от касова бележка: ${text}\n\nИнструкции от потребителя: ${prompt}`;
            
            const response = await openai.chat.completions.create({
                model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
                messages: [
                    { 
                        role: "system", 
                        content: "Вие сте полезен асистент, който анализира данни от касови бележки. Давайте ясни и кратки отговори на български език." 
                    },
                    { 
                        role: "user", 
                        content: finalPrompt 
                    }
                ],
                max_tokens: 500,
            });
            
            // Display the AI response
            aiResponse.textContent = response.choices[0].message.content;
            
        } catch (error) {
            console.error('AI Analysis Error:', error);
            aiResponse.textContent = `Грешка: ${error.message || 'Неуспешно получаване на AI отговор. Моля проверете вашия API ключ и опитайте отново.'}`;
        } finally {
            aiLoading.classList.add('hidden');
        }
    }

    /**
     * Gets the OpenAI API key from the environment
     */
    function getApiKey() {
        // The API key will be injected via server-side at runtime
        // In this client-side code, we fetch it from a global variable
        // that will be defined by our server
        return window.OPENAI_API_KEY || '';
    }

    /**
     * Resets the entire application to its initial state
     */
    function resetAll() {
        resetImageCapture();
        ocrResult.classList.add('hidden');
        aiPrompt.classList.add('hidden');
        aiResult.classList.add('hidden');
        extractedText.value = '';
        // Keep the promptText value for convenience
    }

    // Ensure process.env exists to prevent errors
    if (typeof process === 'undefined' || !process.env) {
        window.process = { env: {} };
    }
});

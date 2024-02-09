// Etiketler dizini, her çalışanın ID'si ve yüz tanıma için kullanılacak resim dosyaları
const labelsDir = {
    1: ['1.png'],
    2: ['1.png'],
};

let isCameraOpen = false;
let intervalId;

// Başlatma butonuna tıklandığında yürütülecek fonksiyonu bekle
document.getElementById('startButton').addEventListener('click', startRecognition);

// Tanıma işlemini başlatan asenkron fonksiyon
async function startRecognition() {
    const inputId = 1;

    // ID girişi yapılmamışsa uyarı ver ve çık
    if (!inputId) {
        alert('Please enter an ID.');
        return;
    }

    isCameraOpen = true; //kameranın açık olduğunu belirt

    await loadModels(); // Modelleri yükleyen fonksiyonu çağır
    
    startVideo(inputId); // Video işlemini başlat
}

// Yüz tanıma için modelleri yükler
async function loadModels() {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('models');
}

// Canlı Görüntü işlemini başlatır
async function startVideo(inputId) {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Kameraya erişim
    navigator.getUserMedia(
        { video: {} },
        (stream) => {
            // Video elementine stream'i atama
            video.srcObject = stream;

            //Canlı Görüntü yüklendiğinde çalışacak fonksiyon
            video.addEventListener('loadeddata', () => {

                // Görüntü alanı boyutları
                const displaySize = { width: video.width, height: video.height };
                faceapi.matchDimensions(canvas, displaySize);

                // İlk tespit durumu
                let isFirstDetection = true;
                
                // Belirli aralıklarla tespitleri kontrol etmek için interval fonksiyonu
                intervalId = setInterval(async () => {
                    // Kamera kapalı veya ilk tespit yapılmışsa interval'ı durdur
                    if (!isCameraOpen || !isFirstDetection) {
                        clearInterval(intervalId);
                        return;
                    }

                    // Yüz tespiti yap
                    const detections = await faceapi
                        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                        
                    //canvası temizle    
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Eğer tespit varsa canvas'ı gizle
                    if (detections.length > 0) {
                        ctx.canvas.style.display = 'none';
                    }

                    //ilk tespitte çalışanı tanı ve karşılaştır
                    if (detections.length > 0 && isFirstDetection) {
                        const recognizedWorker = await recognizeWorker(detections[0].descriptor);
                        //console.log(recognizedWorker);
                        closeCamera();
                        compareId(recognizedWorker, inputId);
                        
                    }
                }, 100);
            });
        },
        (err) => console.error(err)
    );
}

// Çalışanı tanıyan asenkron fonksiyon
async function recognizeWorker(queryDescriptor) {
    const labeledDescriptors = await Promise.all(
        Object.keys(labelsDir).map(async (worker) => {
            const descriptors = await Promise.all(
                labelsDir[worker].map(async (imageName) => {
                    // Etiketli resimleri yüz tanıma için yükle
                    const img = await faceapi.fetchImage(`labels/${worker}/${imageName}`);
                    const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
                    return detections.map(detection => detection.descriptor);
                })
            );
            return new faceapi.LabeledFaceDescriptors(worker, descriptors.flat()); // descriptors.flat() kullanarak iç içe dizileri birleştir
        })
    );

    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors); // Yüz tanıma işlemi için FaceMatcher oluştur
    const bestMatch = faceMatcher.findBestMatch(queryDescriptor); // En iyi eşleşmeyi bul

    return bestMatch.label.toString(); // Eşleşen çalışanın ID'sini döndür
}

// ID'leri karşılaştırır
function compareId(recognizedId, inputId) {
    if (parseInt(recognizedId) === parseInt(inputId)) {
        alert('Person recognized!');
        location.reload();
    } else {
        alert('Person not recognized. Please try again.');
        location.reload();
    }
}

// Kamerayı kapatır
function closeCamera() {
    const video = document.getElementById('video');
    const stream = video.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());

    isCameraOpen = false;
    clearInterval(intervalId);
}

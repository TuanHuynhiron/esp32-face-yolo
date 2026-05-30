const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Biến lưu trữ IP động của 2 ESP do người dùng nhập từ giao diện Web
let esp32CamIp = "";
let esp32Ip = "";
let lastFaceResult = "Chưa nhận diện";

// API 1: Lưu cấu hình IP từ Web gửi lên
app.post('/api/config', (req, res) => {
    esp32CamIp = req.body.esp32CamIp;
    esp32Ip = req.body.esp32Ip;
    console.log(`[Config] Cam IP: ${esp32CamIp} | Main IP: ${esp32Ip}`);
    res.json({ status: "success", message: "Đã cập nhật IP thành công" });
});

// API 2: Lấy trạng thái kết quả hiện tại để hiển thị lên giao diện Web
app.get('/api/status', (req, res) => {
    res.json({
        esp32CamIp,
        esp32Ip,
        lastFaceResult
    });
});

// API 3: Web Client gửi ảnh từ ESP32-CAM lên để Server phân tích khuôn mặt
app.post('/api/process-face', async (req, res) => {
    const { image, matchResult } = req.body; 
    // matchResult sẽ do tầng AI phía Client hoặc Server gửi (ở đây xử lý mẫu logic nhận kết quả)
    
    if (matchResult && matchResult !== "unknown") {
        lastFaceResult = `ĐÚNG FACE ID: ${matchResult.toUpperCase()}`;
        
        // Gửi lệnh kích hoạt mở cửa tới ESP32 chính qua HTTP Gốc
        if (esp32Ip) {
            try {
                // Giả định ESP32 chính có đường dẫn /cam_trigger khi nhận tín hiệu AI
                await axios.get(`http://${esp32Ip}/status?face=1`, { timeout: 2000 });
                console.log("-> Đã kích hoạt mở cửa trên ESP32");
            } catch (err) {
                console.log("Không thể kết nối tới ESP32 chính để mở cửa");
            }
        }
    } else {
        lastFaceResult = "SAI FACE ID / UNKNOWN";
    }
    
    res.json({ status: "ok", result: lastFaceResult });
});

// API 4: Yêu cầu Thêm/Thay đổi FaceID từ xa (Lưu ảnh mới vào bộ nhớ)
app.post('/api/enroll-face', (req, res) => {
    const { label, imageBase64 } = req.body; // label ví dụ: "admin"
    if (!label || !imageBase64) {
        return res.status(400).json({ error: "Thiếu dữ liệu khuôn mặt" });
    }

    try {
        const base64Data = imageBase64.replace(/^data:image\/jpeg;base64,/, "");
        const uploadPath = path.join(__dirname, 'public', 'labels', `${label}.jpg`);
        
        fs.writeFileSync(uploadPath, base64Data, 'base64');
        console.log(`[Enroll] Đã lưu FaceID mới cho: ${label}`);
        res.json({ status: "success", message: `Đã cập nhật FaceID cho ${label}` });
    } catch (error) {
        res.status(500).json({ error: "Lỗi không thể lưu file ảnh" });
    }
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại port: ${PORT}`);
});
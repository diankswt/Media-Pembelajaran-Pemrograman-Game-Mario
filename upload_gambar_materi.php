<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$uploadDir = '../uploads/materi/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

if (!isset($_FILES['gambar'])) {
    echo json_encode(['success' => false, 'message' => 'Tidak ada file']);
    exit;
}

$file     = $_FILES['gambar'];
$ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowed  = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

if (!in_array($ext, $allowed)) {
    echo json_encode(['success' => false, 'message' => 'Format tidak didukung']);
    exit;
}

$filename = 'materi_' . time() . '_' . rand(100, 999) . '.' . $ext;
$target   = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $target)) {
    echo json_encode(['success' => true, 'filename' => $filename]);
} else {
    echo json_encode(['success' => false, 'message' => 'Gagal upload']);
}
?>
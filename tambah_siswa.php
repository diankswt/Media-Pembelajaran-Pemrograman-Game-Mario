<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'koneksi.php';

$data     = json_decode(file_get_contents('php://input'), true);
$nama     = mysqli_real_escape_string($conn, trim($data['nama']));
$username = mysqli_real_escape_string($conn, trim($data['username']));
$password = mysqli_real_escape_string($conn, trim($data['password']));

if (empty($nama) || empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Semua field wajib diisi!']);
    exit;
}

// Cek username sudah ada
$cek = "SELECT id FROM siswa WHERE username = '$username'";
$result = mysqli_query($conn, $cek);
if (mysqli_num_rows($result) > 0) {
    echo json_encode(['success' => false, 'message' => 'Username sudah digunakan!']);
    exit;
}

$sql = "INSERT INTO siswa (nama, username, password) VALUES ('$nama','$username','$password')";

if (mysqli_query($conn, $sql)) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
}
mysqli_close($conn);
?>
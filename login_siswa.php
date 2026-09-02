<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'koneksi.php';

$data = json_decode(file_get_contents('php://input'), true);

$username = mysqli_real_escape_string($conn, trim($data['username']));
$password = mysqli_real_escape_string($conn, trim($data['password']));

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Username dan password wajib diisi!']);
    exit;
}

$sql = "SELECT * FROM siswa WHERE username = '$username' AND password = '$password'";
$result = mysqli_query($conn, $sql);

if (mysqli_num_rows($result) == 1) {
    $siswa = mysqli_fetch_assoc($result);
    echo json_encode([
        'success'  => true,
        'message'  => 'Login berhasil!',
        'siswa_id' => $siswa['id'],
        'nama'     => $siswa['nama'],
        'username' => $siswa['username']
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Username atau password salah!']);
}

mysqli_close($conn);
?>
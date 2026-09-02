<?php
header('Content-Type: application/json');
require_once 'koneksi.php';

$data     = json_decode(file_get_contents('php://input'), true);
$id       = (int)$data['id'];
$nama     = mysqli_real_escape_string($conn, trim($data['nama']));
$username = mysqli_real_escape_string($conn, trim($data['username']));
$password = trim($data['password'] ?? '');

if ($password !== '') {
    $pw = mysqli_real_escape_string($conn, $password);
    $sql = "UPDATE siswa SET nama='$nama', username='$username', password='$pw' WHERE id=$id";
} else {
    $sql = "UPDATE siswa SET nama='$nama', username='$username' WHERE id=$id";
}

if (mysqli_query($conn, $sql)) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
}
mysqli_close($conn);
?>
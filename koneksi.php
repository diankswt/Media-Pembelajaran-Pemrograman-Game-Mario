<?php
$host     = 'localhost';
$user     = 'root';
$password = '';
$database = 'mariogame';

$conn = mysqli_connect($host, $user, $password, $database);

if (!$conn) {
    die(json_encode([
        'success' => false,
        'message' => 'Koneksi database gagal: ' . mysqli_connect_error()
    ]));
}

mysqli_set_charset($conn, 'utf8');
?>
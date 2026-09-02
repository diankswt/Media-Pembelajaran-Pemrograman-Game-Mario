<?php
header('Content-Type: application/json');
require_once 'koneksi.php';

if (isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $result = mysqli_query($conn, "SELECT id, nama, username FROM siswa WHERE id=$id");
    echo json_encode(mysqli_fetch_assoc($result));
} else {
    $result = mysqli_query($conn, "SELECT id, nama, username, created_at FROM siswa ORDER BY nama");
    $data = [];
    while ($row = mysqli_fetch_assoc($result)) $data[] = $row;
    echo json_encode($data);
}
mysqli_close($conn);
?>
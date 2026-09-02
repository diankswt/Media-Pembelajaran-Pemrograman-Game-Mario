<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once 'koneksi.php';

$topik = isset($_GET['topik']) ? mysqli_real_escape_string($conn, $_GET['topik']) : '';
$slot  = isset($_GET['slot'])  ? (int)$_GET['slot'] : 0;
$id    = isset($_GET['id'])    ? (int)$_GET['id']   : 0;

if ($id > 0) {
    $result = mysqli_query($conn, "SELECT * FROM soal WHERE id=$id");
    $data = [];
    while ($row = mysqli_fetch_assoc($result)) $data[] = $row;
    echo json_encode($data);

} elseif ($slot > 0 && $topik !== '') {
    $result = mysqli_query($conn, "SELECT * FROM soal WHERE topik='$topik' AND slot=$slot ORDER BY id ASC");
    $data = [];
    while ($row = mysqli_fetch_assoc($result)) $data[] = $row;
    echo json_encode($data);

} else {
    $result = mysqli_query($conn, "SELECT * FROM soal WHERE topik='$topik' ORDER BY slot ASC, id ASC");
    $data = [];
    while ($row = mysqli_fetch_assoc($result)) $data[] = $row;
    echo json_encode($data);
}

mysqli_close($conn);
?>
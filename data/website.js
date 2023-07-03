import {Player} from "pointcloud";

function updateStatus(text) {
    
}


/**
 * Load when the document is ready!
 */
let player = undefined;
function startPointCloudVisualization(ev) {
    var render_window = document.getElementById("render_window");

    player = new Player(
            render_window,
            updateStatus,
            undefined,
            true,
            false);
    
    player.loadSinglePointCloud("pointclouds/kreuzberg_ball_2/161.ply")
}


window.onload = startPointCloudVisualization;

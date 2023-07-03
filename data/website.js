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
    
    player.loadSinglePointCloud("pointclouds/wiesenhagen/image.pcd")
}


window.onload = startPointCloudVisualization;

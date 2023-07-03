import {Player} from "pointcloud";

function updateStatus(text) {
    
}


function pointCloudPath(defaultPath) {
    const urlParams = new URLSearchParams(window.location.search);
    const pointCloud = urlParams.get("pointcloud");

    if(null === pointCloud) {
	return defaultPath;
    }

    return pointCloud;
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
    
    player.loadSinglePointCloud(pointCloudPath("pointclouds/kreuzberg_ball_2/images/161.pcd"))
}


window.onload = startPointCloudVisualization;

import {Player} from "pointcloud";

const TYPE_TO_NAME = {
    color: "Color",
    combined: "Combined"
};


class Controller {
    constructor(on_render_frame_callback = undefined) {
        this.on_render_frame_callback = on_render_frame_callback
        this.player = undefined;
        this.scene_configurations = undefined;
        
        // already collect all the elements
        this.render_window = document.getElementById("render_window");
        this.status_element = document.getElementById("status");
        this.select_scene_element = document.getElementById("select_scene");
        this.select_type_element = document.getElementById("select_type");
        this.play_pause_button = document.getElementById("play_pause");
        this.next_frame_button = document.getElementById("next_frame");
        this.previous_frame_button = document.getElementById("previous_frame");
        
        // the controller is now ready, we only have to load the
        // configurations
        this.fetchJSON("/configurations", this.initialize.bind(this));
    }
    
    
    /**
     * Initialize the controller.
     * 
     * This function is called when the scene configuration is loaded.
     */
    initialize(configurations) {
        this.player = new Player(
            this.render_window,
            this.updateStatus.bind(this),
            this.on_render_frame_callback);
        this.scene_configurations = configurations;
        
        this.updateSceneMenue();
        this.createEventListeners();
    }
    
    
    /**
     * Set up listeners for elements.
     * 
     * There are some elements like buttons or drop-down menues which change
     * their value. The controller has to react to these messages.
     */
    createEventListeners() {
        this.select_scene_element.addEventListener(
            "change",
            this.onSelectScene.bind(this));
        
        this.select_type_element.addEventListener(
            "change",
            this.onSelectType.bind(this));
        
        this.play_pause_button.addEventListener(
            "click",
            this.playFrames.bind(this));
        
        this.next_frame_button.addEventListener(
            "click",
            this.jumpToNextFrame.bind(this));

        this.previous_frame_button.addEventListener(
            "click",
            this.jumpToPreviousFrame.bind(this));
    }
    
    
    /**
     * Fetch some JSON data.
     * 
     * Fetches JSON data from the given URL and calls the callback with the
     * data when it is fully loaded.
     */
    fetchJSON(url, callback) {
        fetch(url)
            .then((response) => response.json())
            .then(callback);
    }
    
    
    /**
     * Update the drop-down menue containing the scenes.
     * 
     * It automatically updates the drop-down menue with the point-cloud
     * types.
     */
    updateSceneMenue() {
        for(const identifier in this.scene_configurations) {
            const scene = this.scene_configurations[identifier];
            const name = scene["name"];
            
            var entry = document.createElement("option");
            entry.textContent = name;
            entry.value = identifier;
            
            select_scene.appendChild(entry);
        }
        
        // point clouds depend on selected scene
        this.onSelectScene();
    }
    
    
    /*
     * When a scene is selected, update the available types.
     */
    onSelectScene() {
        const scene_identifier = this.select_scene_element.value;
        const scene = this.scene_configurations[scene_identifier];
        const frames = scene["frames"];
        const types = this.typesInFrames(frames);
        
        const previous_value = this.select_type_element.value;
        this.updateTypesMenue(types);
        
        // if the previously selected type is also availble, use it!
        if(types.has(previous_value)) {
            this.select_type_element.value = previous_value;
        }
        
        this.onSelectType();
    }
    
    
    /**
     * Extract point-cloud types from a list of frames.
     * 
     * The method iterates all frames and finds the available point-cloud
     * types.
     */
    typesInFrames(frames) {
        var types = new Set();
        for(const frame of frames) {
            const clouds = frame["clouds"];
            
            for(const type in clouds) {
                types.add(type);
            }
        }
        
        return types;
    }
    
    
    /**
     * Update menue with point-cloud types.
     */
    updateTypesMenue(types) {
        // refill the list of types
        this.select_type_element.replaceChildren();
        for(const type of types.values()) {
            var entry = document.createElement("option");
            var name = type in TYPE_TO_NAME ? TYPE_TO_NAME[type] : "<" + type + ">";
            
            entry.textContent = name;
            entry.value = type;
            
            this.select_type_element.appendChild(entry);
        }
    }
    
    
    /**
     * Callback function: is called on point-cloud type selection.
     */
    onSelectType() {
        // always clear the point cloud
        this.player.reset();
        
        // now figure out what to do next
        const scene_identifier = this.select_scene_element.value;
        const type_identifier = this.select_type_element.value;
        const scene = this.scene_configurations[scene_identifier];
        const frames = scene["frames"];
        const name = scene["name"]
        
        this.player.loadPointClouds(name, frames, type_identifier);
        this.updatePlayPauseButton();
    }
    
    
    /**
     * Change the value of the play button.
     * 
     * If the player is playing, the button shows "pause". If the player is
     * pausing, the button shows "play".
     */
    updatePlayPauseButton() {
        if(this.player.is_playing) {
            this.play_pause_button.innerHTML = "PAUSE";
        } else {
            this.play_pause_button.innerHTML = "PLAY";
        }
    }
    
    
    /**
     * Start playing frames.
     * 
     * Called when the play button is pressed.
     */
    playFrames() {
        this.player.play();
        
        this.updatePlayPauseButton();
    }
    
    
    /**
     * Pause playing frames.
     */
    pausePlayer() {
        this.player.pause();
        this.updatePlayPauseButton();
    }


    /**
     * Go to the next frame.
     */
    jumpToNextFrame() {
        this.pausePlayer();
        
        this.player.nextFrame();
    }

    
    /**
     * Go to the previous frame.
     */
    jumpToPreviousFrame() {
        this.pausePlayer();
        
        this.player.previousFrame();
    }
    
    
    /**
     * Update the status shown in the visualization.
     */
    updateStatus(text) {
        this.status_element.innerHTML = text;
    }
}


/**
 * Called after a frame is rendered.
 */
function on_render_frame_callback(image, index, timestamp, path, scene) {
    var data = new FormData();
    data.append("timestamp", timestamp);
    data.append("index", index);
    data.append("path", path);
    data.append("image", image);
    data.append("scene", scene);
    
    var request = new XMLHttpRequest();
    request.open("POST", "/callback", true);
    request.send(data);
}


/**
 * Load when the document is ready!
 */
let controller = undefined;
function loadController(ev) {;
    controller = new Controller(on_render_frame_callback);
}

window.onload = loadController;

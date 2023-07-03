import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';

const INCREASE_KEY = "+";
const DECREASE_KEY = "-";
const CAMERA_FIELD_OF_VIEW = 60;
const NEAR_CLIPPING_PLANE = 0.01;
const FAR_CLIPPING_PLANE = 1000.0;
const POINT_CLOUD_NAME = "point_cloud";


/**
 * Compare two objects with timestamps.
 */
function compareByTimestamp(a, b) {
    var ta = a.timestamp;
    var tb = b.timestamp;
    
    if(ta < tb) {
        return -1;
    } else if(tb < ta) {
        return 1;
    }
    
    return 0;
}


/**
 * Render a single point cloud.
 */
export function PointCloudRenderer(render_window, enableAxesHelper=false, center=false) {
    this.resize_factor = 1.5;
    this.center = center;
    this.render_window = render_window;
    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.windowWidth(), this.windowHeight());
    
    render_window.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = this.createCamera();
        
    this.camera.position.set(0, 0, -50);
    this.scene.add(this.camera);

    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.minDistance = 0.5;
    controls.maxDistance = 100;
    controls.addEventListener('change', this.render.bind(this)); // use if there is no animation loop

    if(enableAxesHelper) {
//        this.scene.add(new THREE.AxesHelper(1));
    }

    window.addEventListener('resize', this.onWindowResize.bind(this) );
}


PointCloudRenderer.prototype.windowWidth = function() {
    return this.render_window.clientWidth;
}


PointCloudRenderer.prototype.windowHeight = function() {
    return this.render_window.clientHeight;
}


PointCloudRenderer.prototype.aspectRatio = function() {
    return this.windowWidth() / this.windowHeight();
}


/**
 * Create camera for rendering.
 */
PointCloudRenderer.prototype.createCamera = function() {
    return new THREE.PerspectiveCamera(
        CAMERA_FIELD_OF_VIEW,
        this.aspectRatio(),
        NEAR_CLIPPING_PLANE,
        FAR_CLIPPING_PLANE);
};


/**
 * Default transformation for our point clouds.
 * 
 * This transformation centers the point cloud and rotates it around the X and
 * the Z axes to fix the orientation. This might need to change and become
 * more flexible in the long run.
 */
function transform(points, name, center=false) {
    if(center) {
        points.geometry.center();
    }
    
    points.geometry.rotateX(Math.PI);
    points.geometry.rotateZ(Math.PI);
    points.name = POINT_CLOUD_NAME;
}


/**
 * Load a point cloud from a file.
 * 
 * The point cloud is automatically added to then scene which is then updated
 * and rendered. This might not be the desired behavior in case of multiple
 * point clouds or a point cloud animation.
 **/
PointCloudRenderer.prototype.loadPointCloud = function(path, name, meta, callback) {
    const loader = new PCDLoader();
    loader.load(path, (function (points) {
        transform(points, name, this.center);

        points.material.size = 0.05;
+       points.material.fog = false;
        
        callback(points, meta);
    }).bind(this));
};


/**
 * Remove a point cloud from the scene.
 */
PointCloudRenderer.prototype.removePointCloud = function(name) {
    const points = this.scene.getObjectByName(name);
    
    this.scene.remove(points);
};


/**
 * Handles a resize event.
 * 
 * When the window is resized, everything needs to be redrawn.
 */
PointCloudRenderer.prototype.onWindowResize = function() {
    this.camera.aspect = this.aspectRatio();
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.windowWidth(), this.windowHeight());
    
    this.render();
};


/**
 * Render the entire scene.
 */
PointCloudRenderer.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
};


/**
 * Add something to the scene.
 */
PointCloudRenderer.prototype.addToScene = function(points) {
    this.scene.add(points);
}



/**
 * Plays sequences of point clouds.
 * 
 * This player just loads a sequence of frames as an input and is capable of
 * replaying the data.
 */
export class Player {
    /**
     * Set up the player.
     * 
     * Initially, the playre is not playing anything. It's set to pause and
     * awaits commands.
     * 
     * :param render_window: this is where the scene is rendered
     * :param status_callback: is called in case of status updates; only a
     *     single parameter is passed: the status as text.
     */
    constructor(render_window, status_callback, on_render_frame_callback=undefined, center=false, show_helper=false) {
        this.status_callback = status_callback;
        this.on_render_frame_callback = on_render_frame_callback;
        this.renderer = new PointCloudRenderer(render_window, show_helper, center);
        this.event_identifier = 0;
        this.render_window = render_window
        
        this.is_playing = false;
        this.loaded = false;
        this.frames = [];
        this.current_frame = undefined;
    }
    
    
    /**
     * Load a sequence of point clouds.
     * 
     * After the sequence is loaded, the scene can be replayed.
     * 
     * The method is non-blocking and calls `pointCloudLoaded` for every
     * loaded point cloud.
     * 
     * :param name: name of the scene
     * :param frames: frames to be loaded
     * :param type_identifier: indicates the type of the point-cloud data;
     *     for example plain color for camera based colors
     */
    loadPointClouds(name, frames, type_identifier) {
        this.status("Loading point clouds.");
        
        // don't show any data
        this.reset();
        
        if(0 == frames.length) {
            this.status("No frames in scene.");
            return;
        }
        
        for(var index = 0; index < frames.length; ++index) {
            const frame = frames[index];
            const timestamp = frame["timestamp"];
            const clouds = frame["clouds"];
                
            if(0 == clouds.length) {
                // nothing to show
                this.status("No clouds in frame.");
                return;
            }
            
            const cloud = clouds[type_identifier];
            
            // FIXME: That's not so nice here and should be solved on the server side
            const path = cloud["path"];
            const full_path = "pointclouds/" + path;
                
            var meta = {
                event_identifier: this.event_identifier,
                scene: name,
                index: index,
                num_frames: frames.length,
                timestamp: timestamp,
                path: path
            };
            
            this.status("Loading point clouds...");
            this.loadPointCloud(full_path, meta);
        }
    }
    
    
    /**
     * Load a point cloud.
     */
    loadPointCloud(full_path, meta, name=POINT_CLOUD_NAME) {
        this.renderer.loadPointCloud(
            full_path,
            name,
            meta,
            this.pointCloudLoaded.bind(this));
    }
    
    
    /**
     * Load a single point cloud.
     */
    loadSinglePointCloud(full_path) {
        this.reset();
        
        const meta = {
            // the identifier must match the scene
            event_identifier: this.event_identifier,
            
            // there is only a single frame
            num_frames: 1
        };
            
        this.loadPointCloud(full_path, meta)
    }
    
    
    /**
     * Resets the scene.
     * 
     * This means stopping the player, removing the frames and removing all
     * the point clouds from the scene.
     */
    reset() {
        // we are now one step further and don't want to render old data
        this.pause();
        this.loaded = false;
        this.current_frame = undefined;
        this.frames = []
        this.event_identifier++;
        
        // remove the point cloud from the scene
        this.renderer.removePointCloud(POINT_CLOUD_NAME);
    }
    
    
    /**
     * Is called when a point cloud is loaded.
     * 
     * This method is handling new point clouds. If a new one is available, it
     * is added to the list of frames. If an outdated one is loaded, it is
     * dropped.
     * 
     * When all frames of a scene are loaded, the player is updated and the
     * first frame is rendered.
     * 
     * :param points: point cloud data
     * :param meta: meta data provided by the call of the loader; the meta
     *     data contains information regarding the timestamp, the number of
     *     frames in the scene and to which loading event the data belongs to.
     */
    pointCloudLoaded(points, meta) {
        if(this.event_identifier != meta.event_identifier) {
            // we no langer want this point cloud, ignore it!
            return;
        }
        
        // store the frame, it's a recent one
        this.frames.push({
            timestamp: meta.timestamp,
            path: meta.path,
            scene: meta.scene,
            points: points
        });
        
        this.status("Loaded " + this.frames.length + " frames of " + meta.num_frames + ".");
        
        if(this.frames.length == meta.num_frames) {
            // all frames loaded, sort them by timestamp
            this.normalizeFrames();
            this.status("Ready.")
            
            // start with the first frame
            this.current_frame = -1;
            
            this.loaded = true;
            this.nextFrame();
        }
    }
    
    
    /**
     * Normalize all frames of a scene.
     * 
     * Noramlization consists of two steps. In a first step, the frames are
     * sorted by the timestamp. I.e. smaller timestamsp are at the beginning
     * of the sequence.
     * 
     * Additionally, the timestamps themselves are normalzed. Therefore, the
     * smllest timestamp in the sequence is subtracted from all frames in the
     * scene. Hence, the first timestamp is always 0.
     */
    normalizeFrames() {
        // all frames loaded, sort them by timestamp
        this.frames.sort(compareByTimestamp);
        
        // and each scene starts at 0 seconds
        this.normalizeTimeStamps();
    }
    
    
    /**
     * Normalization of all time stamps in the scene.
     * 
     * First, the smallest timestamp is substracted from all other timestamps
     * in the sequence. Second, the duration of a frame is added as an
     * attribute to each frame. The last frame gets a default lenght.
     */
    normalizeTimeStamps() {
        if(0 == this.frames.length) {
            // if there are no frames, there is nothing to do
            return;
        }
        
        // all the frames will updated with the first timestamp
        const offset = this.frames[0].timestamp;
        for(var index = 0; index < this.frames.length; ++index) {
            this.frames[index].timestamp -= offset;
        }
        
        // and all frames get a duration
        for(var index = 0; index < this.frames.length - 1; ++index) {            
            const first = this.frames[index].timestamp;
            const second = this.frames[index + 1].timestamp;
            
            this.frames[index].duration = second - first;
        }
        
        // the last frame has a default duration
        this.frames[this.frames.length - 1].duration = 1.0;
    }

    
    /**
     * Set the status message.
     * 
     * Basically just calls the status callback to publish the state of the
     * player.
     * 
     * :param text: the status text which is published
     */
    status(text) {
        this.status_callback(text);
    }
    
    
    /**
     * Go to the next frame.
     * 
     * If applied to the last frame, the first frame is loaded.
     */
    nextFrame() {
        if(undefined == this.current_frame || !this.loaded) {
            return;
        }
        
        this.current_frame = (this.current_frame + 1) % this.frames.length;
        this.showCurrentFrame();
    }
    
    
    /**
     * Go to the previous frame.
     * 
     * If applied to the first frame, the last frame is loaded.
     */
    previousFrame() {
        if(undefined == this.current_frame || !this.loaded) {
            return;
        }
        
        this.current_frame = (this.frames.length + this.current_frame - 1) % this.frames.length;
        this.showCurrentFrame();
    }
    
    
    /**
     * Show the currently selected frame.
     */
    showCurrentFrame() {
        const frame = this.frames[this.current_frame];
        
        this.status("Frame " + (this.current_frame + 1) + " of " + this.frames.length + ".");
        
        this.renderer.removePointCloud(POINT_CLOUD_NAME);
        this.renderer.addToScene(frame.points);
        this.renderer.render();
        
        if(this.on_render_frame_callback !== undefined) {
            const image = this.renderer.renderer.domElement.toDataURL();
            this.on_render_frame_callback(
                image,
                this.current_frame,
                frame.timestamp,
                frame.path,
                frame.scene);
        }
    }
    
    
    /**
     * Play the sequence.
     * 
     * Each frame of the sequence is shown for the specified duration. At the
     * end of all frames, the player starts again with the first frame.
     */
    play() {
        if(this.frames.length < 2) {
            // playing no frames or just a single one makes no sense
            return false;
        }
        
        if(!this.loaded) {
            // not all frames loaded yet
            return false;
        }
        
        if(this.is_playing) {
            // already playing data
            this.pause();
        } else {
            this.is_playing = true;
            
            // start playing
            this.createNextFrameTimer();
        }
        
        return this.is_playing;
    }

    
    /**
     * Pause the player.
     * 
     * Pausing the player basically end the replay at the current frame. After
     * a pause it is possible to play again.
     */
    pause() {
        this.is_playing = false;
    }
    
    
    /**
     * Is called after a frame is rendered.
     * 
     * This funciton then creates a timer with the duration of the current
     * frame. After this duration, the callback function is called and the
     * next frame is played. This is the foundation of the play loop.
     */
    createNextFrameTimer() {
        const seconds = this.frames[this.current_frame].duration;
        
        setTimeout(this.playNextFrameCallback.bind(this), 1000 * seconds);
    }

    
    /**
     * Show a new frame.
     * 
     * This is the callback function used to render a new frame. When the
     * frame is shown, a new timer is set for the next frame.
     */
    playNextFrameCallback() {
        if(!this.is_playing) {
            return;
        }
        
        this.nextFrame();
        this.createNextFrameTimer();
    }
        
}

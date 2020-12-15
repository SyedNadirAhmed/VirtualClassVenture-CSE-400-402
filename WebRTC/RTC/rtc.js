var Demo = (function(){
    var audio_Track;
    var video_Track = null;
    var screen_Track = null;

    var _mediaRecorder;
    var _recordedTrack = [];

    var connection = null;
    var _remoteStream = new MediaStream();

    var localVideo;
    var rtpSender;

    var socket = io.connect('http://localhost:3000');

    async function _init(){
        // await startWithAudio();
        localVideo = document.getElementById('videoCtr');
        eventBinding();
    }

    // Button function

    function eventBinding(){
        $("#btnMuteUnmute").on('click', function(){
            if(!audio_Track) return;

            if(audio_Track.enabled == false){
                audio_Track.enabled = true;
                $(this).text("Mute");
            }
            else{
                audio_Track.enabled = false;
                $(this).text("Unmute");
            }

            // console.log(audio_Track);
        });

        $("#btnStartReco").on('click', function(){
            setupMediaRecorder();
            _mediaRecorder.start(1000);
        });

        $("#btnPauseReco").on('click', function(){
            _mediaRecorder.pause();
        });

        $("#btnResumeReco").on('click', function(){
            _mediaRecorder.resume();
        });

        $("#btnStopReco").on('click', function(){
            _mediaRecorder.stop();
        });

        
        // Camera Start
        $("#btnStartStopCam").on('click', async function(){
            if(video_Track){
                video_Track.stop();
                video_Track = null;
                // document.getElementById('videoCtr').srcObject = null;
                localVideo.srcObject = null;
                $("#btnStartStopCam").text("Start Camera");

                if(rtpSender && connection){
                    connection.removeTrack(rtpSender);
                    rtpSender = null;
                }

                return;
            }
            try{
                var vstream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: 400,
                        height: 300
                    },
                    audio: false
                });
                // console.log(vstream);

                if(vstream && vstream.getVideoTracks().length > 0){
                    video_Track = vstream.getVideoTracks()[0];
                    // console.log(video_Track);
                    setLocalVideo(true);
                    // document.getElementById('videoCtr').srcObject = new MediaStream([video_Track]);
                    // localVideo.srcObject = new MediaStream([video_Track]);
                    $("#btnStartStopCam").text("Stop Camera");
                }
            }catch(e){
                console.log(e);
                return;
            }
        });

        $("#btnStartStopScreenshare").on('click', async function(){

            if(screen_Track){
                screen_Track.stop();
                screen_Track = null;
                localVideo.srcObject = null;
                $(this).text("Screen Share");

                if(rtpSender && connection){
                    connection.removeTrack(rtpSender);
                    rtpSender = null;
                }
                return;
            }try{
                var screen_Stream = await navigator.mediaDevices.getDisplayMedia({
                    audio: false,
                    video: {
                        framerate: 1,
                    },
                });
                if(screen_Stream && screen_Stream.getVideoTracks().length > 0){
                    screen_Track = screen_Stream.getVideoTracks()[0];
                    setLocalVideo(false);
                    $(this).text("Stop Share");
                }
            }catch(e){
                console.log(e);
                return;
            }

        });



        // Stat connection
        $("#startConnection").on('click', async function(){
            await startWithAudio();
            await create_Connection();
            // await create_Offer();
        });
    }


    // setLocalVideo
    function setLocalVideo(isVideo){
        var curretn_Track;

        if(isVideo){ 
            if (screen_Track) 
                $("#btnStartStopScreenshare").trigger('click');
        
            if(video_Track){
                localVideo.srcObject = new MediaStream([video_Track]);
                curretn_Track = video_Track;
            }
        }

        else{
            if(video_Track){
                $("#btnStartStopCam").trigger('click');
            }

            if(screen_Track){
                localVideo.srcObject = new MediaStream([screen_Track]);
                curretn_Track = screen_Track;
            }
        }

        if(rtpSender && rtpSender.track && curretn_Track && connection){
            rtpSender.replaceTrack(curretn_Track);
        }
        else{
            if(curretn_Track && connection){
                rtpSender = connection.addTrack(curretn_Track);
            }
        }
    }


    // Record live stream
    function setupMediaRecorder(){
        var _width = 0;
        var _height = 0;

        if(screen_Track){
            _width = screen_Track.getSettings().width;
            _height = screen_Track.getSettings().height;
        }
        else if(video_Track){
            _width = video_Track.getSettings().width;
            _height = video_Track.getSettings().height;
        }

        
        // Merge camera with screen
        var merger = new VideoStreamMerger({
            width: _width,
            height: _height,

            audioContext: null,
        });

        if(screen_Track && screen_Track.readyState === "live"){
            // Add the screen capture. Position it to fill the whole stream (the default)
            merger.addStream(new MediaStream([screen_Track]),{
                x: 0,
                y: 0,
                mute: true
            });

            if(video_Track && video_Track.readyState === "live"){
                merger.addStream(new MediaStream([video_Track]),{
                    x: 0,
                    y: merger.height - 100,
                    width: 100,
                    height: 100,
                    mute: true
                });
            }
        }
        else{
            if(video_Track && video_Track.readyState === "live"){
                // Add the webcam stream
                merger.addStream(new MediaStream([video_Track]),{
                    x: 0,
                    y: 0,
                    width: _width,
                    height: _height,
                    mute: true
                });
            }
        }


        if(audio_Track && audio_Track.readyState === "live"){
            // Add the webcam stream. Position it on the bottom left and resize it to 100x100.
            merger.addStream(new MediaStream([audio_Track]), {
                mute: false
            });
        }

        // Start the merging
        merger.start();


        // We now have a merged MediaStream
        var stream = merger.result;
        var videoRecPlayer = document.getElementById('videoCtrRec');
        videoRecPlayer.srcObject = stream;
        videoRecPlayer.load();
        $(videoRecPlayer).show();

        stream.getTracks().forEach(track =>{
            console.log(track);
        });

        //Recorded Array
        _recordedTrack = [];
        _mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus' });
        _mediaRecorder.ondataavailable = (e) => {
            console.log(e.data.size);
            if (e.data.size > 0)
                _recordedTrack.push(e.data);
        };
        _mediaRecorder.onstart = async () => {
            console.log('onstart');
            $("#btnStartReco").hide();
            $("#btnPauseReco").show();
            $("#btnStopReco").show();
            $("#downloadRecording").hide();
        };
        _mediaRecorder.onpause = async () => {
            $("#btnPauseReco").hide();
            $("#btnResumeReco").show();
        };
        _mediaRecorder.onresume = async () => {
            $("#btnResumeReco").hide();
            $("#btnPauseReco").show();
            $("#btnStopReco").show();
        };

        _mediaRecorder.onstop = async () => {
            console.log('onstop');
            var blob = new Blob(_recordedTrack, { type: 'video/webm' });
            let url = window.URL.createObjectURL(blob);


            videoRecPlayer.srcObject = null;
            videoRecPlayer.load();
            videoRecPlayer.src = url;
            videoRecPlayer.play();
            $(videoRecPlayer).show();

            $("#downloadRecording").attr({ href: url, download: 'video.mp4' }).show();

            $("#btnStartReco").show();
            $("#btnPauseReco").hide();
            $("#btnStopReco").hide();
            //var download = document.getElementById('downloadRecording');
            //download.href = url;
            //download.download = 'test.weba';
            //download.style.display = 'block';
        };

    }



    async function startWithAudio() {
        
        try {
            var astream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });

            audio_Track = astream.getAudioTracks()[0];

            audio_Track.onmute = function (e) {
                console.log(e);
            }
            audio_Track.onunmute = function (e) {
                console.log(e);
            }
            
            audio_Track.enabled = false;

        } catch (e) {
            console.log(e);
            return;
        }        
    }

    
    
    // SocketIO
    socket.on("new_message1", async function(message){
        console.log('message', message);
        message = JSON.parse(message);

        if(message.rejected){
            alert("Other user rejected");
        }
        else if(message.answer){
            console.log('answer', message.answer);
            await connection.setRemoteDescription(new RTCSessionDescription(message.answer));
        }
        else if(message.offer){
            console.log('offer', message.offer);
            var vcv = true;

            if(!audio_Track){
                vcv = confirm('Want to continue?');
                if(vcv){
                    await startWithAudio();
                    if(audio_Track){
                        connection.addTrack(audio_Track);
                    }
                }
                else{
                    socket.emit('new_message1', JSON.stringify({'rejected': 'true'}));
                }
            }
            if(audio_Track){
                if(!connection){
                    await create_Connection();
                }

                await connection.setRemoteDescription(new RTCSessionDescription(message.offer));
                var answer = await connection.createAnswer();
                await connection.setLocalDescription(answer);
                socket.emit('new_message1', JSON.stringify({'answer': answer}));
            }
        }
        else if(message.iceCandidate){
            console.log('iceCandidate', message.iceCandidate);
            if(!connection){
                await create_Connection();
            }try{
                await connection.addIceCandidate(message.iceCandidate);
            } catch(e){
                console.log(e);
            }
        }
    });


      
    // Create Connection
    async function create_Connection(){
        console.log('create_Connection');

        connection = new RTCPeerConnection(null);
        connection.onicecandidate = function(event){
            console.log('onicecandidate', event.candidate);
            if(event.candidate){
                socket.emit('new_message1', JSON.stringify({'iceCandidate': event.candidate}));
            }
        }
        connection.onicecandidateerror = function(event){
            console.log('onicecandidateerror', event);
        }
        connection.onicegatheringstatechange = function (event) {
            console.log('onicegatheringstatechange', event);
        };
        connection.onnegotiationneeded = async function(event){
            await create_Offer();
        }
        connection.onconnectionstatechange = function (event) {
            console.log('onconnectionstatechange', connection.connectionState)
            //if (connection.connectionState === "connected") {
            //    console.log('connected')
            //}
        }


        // New remote media stream was added
        connection.ontrack = function(event){
            if(!_remoteStream){
                _remoteStream = new MediaStream();
            }
            if(event.streams.length>0){
                _remoteStream = event.streams[0];
            }
            if(event.track.kind == 'video'){
                _remoteStream.getVideoTracks().forEach(t => _remoteStream.removeTrack(t));
            }

            _remoteStream.addTrack(event.track);
            
            _remoteStream.getTracks().forEach(t => console.log(t));

            var newVideoElement = document.getElementById('remoteVideoCtr');


            newVideoElement.srcObject = null;
            newVideoElement.srcObject = _remoteStream;
            newVideoElement.load();
            // newVideoElement.play();
        };


        if(video_Track){
            rtpSender = connection.addTrack(video_Track);
        }

        if(audio_Track){
            connection.addTrack(audio_Track, _remoteStream);
        }

        if(screen_Track){
            rtpSender = connection.addTrack(screen_Track);
        }
        
    }


    // Create Offer
    async function create_Offer(){
        var offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        console.log('offer', offer);
        console.log('localDescription', connection.localDescription);
        
        // Send offer to server
        socket.emit('new_message1', JSON.stringify({'offer': connection.localDescription}));
    }

    return {
        init: async function () {
            await _init();
        }
    }

}());
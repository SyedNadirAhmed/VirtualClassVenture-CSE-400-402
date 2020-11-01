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
            if(video_Track){
                localVideo.srcObject = new MediaStream([video_Track]);
                curretn_Track = video_Track;
            }
        }
        else{
            if(video_Track){
                $("#btnStartStopCam").trigger('click');
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
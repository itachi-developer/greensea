import React, { useState, useEffect } from 'react';
import { Text, View, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ScreenOrientation from 'expo-screen-orientation';
import ArcadeGameWebView from '../components/ArcadeGameWebView';
import PreGameModal from '../components/PreGameModal';
import { gameStyles } from '../styles/GameStyles';
import { RootStackParamList } from '../navigation/AppNavigator';

const htmlGameContent = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>3D Stop The Clock Cyberpunk</title>
    <style>
        body, html { 
            margin: 0; padding: 0; 
            background: linear-gradient(135deg, #00E5FF 0%, #B026FF 100%);
            overflow: hidden; touch-action: none; font-family: sans-serif; 
        }
        #game-container { width: 100vw; height: 100vh; display: block; }
        
        #ui-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; }
        
        #target-time { color: #FFF; font-size: 26px; font-weight: 900; letter-spacing: 2px; text-shadow: 0px 2px 10px rgba(0,0,0,0.5); margin-bottom: 30px; }
        
        #hourglass { 
            width: 70px; 
            height: 130px; 
            margin-bottom: 40px; 
            display: flex; 
            flex-direction: column; 
            filter: drop-shadow(0 0 15px #00E5FF); 
            transition: opacity 0.2s; 
        }
        .glass-top, .glass-bottom { 
            width: 100%; 
            height: 50%; 
            border: 3px solid rgba(255, 255, 255, 0.9); 
            position: relative; 
            overflow: hidden; 
            background: rgba(0, 229, 255, 0.05); 
        }
        .glass-top { 
            border-radius: 8px 8px 50px 50px; 
            border-bottom: 2px solid rgba(255, 255, 255, 0.5); 
        }
        .glass-bottom { 
            border-radius: 50px 50px 8px 8px; 
            border-top: 2px solid rgba(255, 255, 255, 0.5); 
        }
        .sand { 
            background: #00E5FF; 
            width: 100%; 
            position: absolute; 
            bottom: 0; 
        }

        #result-time { 
            color: #00E5FF; 
            font-size: 70px; 
            font-weight: 900; 
            text-shadow: 0px 0px 20px rgba(0,229,255,0.6); 
            margin-bottom: 40px; 
            font-variant-numeric: tabular-nums; 
            display: none; 
        }

        #instruction { color: rgba(255,255,255,0.8); font-size: 18px; font-weight: bold; letter-spacing: 1px; animation: pulse 1.5s infinite; }
        
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        
        #game-over { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(11, 5, 26, 0.85); color: white; display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 20; backdrop-filter: blur(10px); pointer-events: auto; }
        h1 { font-size: 50px; color: #FF0055; margin-bottom: 10px; text-shadow: 0px 4px 15px #FF0055; margin-top: 0; text-align: center; }
        h2 { font-size: 20px; color: #fff; text-shadow: 0px 2px 5px rgba(0,0,0,0.2); margin-bottom: 30px; text-align: center; }
        
        .start-btn {
            background: #FFEA00;
            color: #050B14;
            font-size: 20px;
            font-weight: 900;
            padding: 16px 40px;
            border: none;
            border-radius: 12px;
            box-shadow: 0px 4px 15px rgba(255,234,0,0.4);
            cursor: pointer;
            letter-spacing: 2px;
        }
        .start-btn:active { transform: scale(0.95); }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
</head>
<body>
    <div id="ui-layer">
        <div id="target-time">TARGET: --</div>
        
        <div id="hourglass">
            <div class="glass-top"><div class="sand" id="sand-top" style="height: 100%;"></div></div>
            <div class="glass-bottom"><div class="sand" id="sand-bottom" style="height: 0%;"></div></div>
        </div>

        <div id="result-time">0.00s</div>
        
        <div id="instruction">TOCCA PER INIZIARE</div>
    </div>
    
    <div id="game-over">
        <h1 id="go-title">FUORI TEMPO!</h1>
        <h2 id="final-stats">Tempo: 0.00s<br>Target: 0.00s</h2>
        <button id="restart-btn" class="start-btn">RIPROVA</button>
    </div>
    <div id="game-container"></div>
    
    <script>
        const container = document.getElementById('game-container');
        const targetDisplay = document.getElementById('target-time');
        
        const hourglass = document.getElementById('hourglass');
        const sandTop = document.getElementById('sand-top');
        const sandBottom = document.getElementById('sand-bottom');
        const resultTimeDisplay = document.getElementById('result-time');
        
        const instruction = document.getElementById('instruction');
        const gameOverScreen = document.getElementById('game-over');
        const finalStats = document.getElementById('final-stats');
        
        let scene, camera, renderer;
        let coreMesh, ringMesh;
        
        let gameState = 'WAITING'; // WAITING, RUNNING, RESULT, GAMEOVER
        let score = 0;
        
        let targetTime = 5;
        let startTime = 0;
        let currentTolerance = 0.3; 
        
        function init() {
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0xB026FF, 0.015);

            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
            camera.position.set(0, 0, 15);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
            scene.add(ambientLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(5, 10, 10);
            scene.add(dirLight);

            const coreGeo = new THREE.IcosahedronGeometry(1.5, 1);
            const coreMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, wireframe: true, transparent: true, opacity: 0.5 });
            coreMesh = new THREE.Mesh(coreGeo, coreMat);
            scene.add(coreMesh);
            
            const ringGeo = new THREE.TorusGeometry(3, 0.1, 16, 100);
            const ringMat = new THREE.MeshStandardMaterial({ color: 0x00E5FF, emissive: 0x0088AA, emissiveIntensity: 0.5 });
            ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            scene.add(ringMesh);

            window.addEventListener('pointerdown', handleTouch);
            
            document.getElementById('restart-btn').addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                fullReset();
            });

            window.addEventListener('resize', onWindowResize);
            
            prepareRound();
            animate();
        }

        function prepareRound() {
            targetTime = Math.floor(Math.random() * 7) + 3;
            currentTolerance = Math.max(0.08, 0.3 - (score * 0.02));
            
            targetDisplay.innerText = 'TARGET: ' + targetTime + '.00s';
            
            hourglass.style.display = 'flex';
            hourglass.style.filter = 'drop-shadow(0 0 15px #00E5FF)';
            sandTop.style.background = '#00E5FF';
            sandBottom.style.background = '#00E5FF';
            sandTop.style.height = '100%';
            sandBottom.style.height = '0%';
            
            resultTimeDisplay.style.display = 'none';
            
            instruction.innerText = "TOCCA PER INIZIARE";
            instruction.style.display = "block";
            
            coreMesh.material.color.setHex(0xFFFFFF);
            ringMesh.material.color.setHex(0x00E5FF);
            ringMesh.material.emissive.setHex(0x0088AA);
            
            gameState = 'WAITING';
        }

        function handleTouch(e) {
            if (e.target.id === 'restart-btn') return;

            if (gameState === 'WAITING') {
                startTime = Date.now();
                gameState = 'RUNNING';
                instruction.innerText = "TOCCA PER FERMARE";
                
                ringMesh.material.color.setHex(0xFFEA00); 
                ringMesh.material.emissive.setHex(0x887700);
                
                hourglass.style.filter = 'drop-shadow(0 0 15px #FFEA00)';
                sandTop.style.background = '#FFEA00';
                sandBottom.style.background = '#FFEA00';
            } 
            else if (gameState === 'RUNNING') {
                stopTimer();
            }
        }

        function stopTimer() {
            gameState = 'RESULT';
            instruction.style.display = "none";
            hourglass.style.display = 'none'; 
            
            const endTime = Date.now();
            const elapsed = (endTime - startTime) / 1000;
            const diff = Math.abs(elapsed - targetTime);
            
            resultTimeDisplay.innerText = elapsed.toFixed(2) + "s";
            resultTimeDisplay.style.display = 'block';
            
            if (diff <= currentTolerance) {
                resultTimeDisplay.style.color = "#39FF14"; 
                resultTimeDisplay.style.textShadow = "0px 0px 20px rgba(57,255,20,0.6)";
                
                coreMesh.material.color.setHex(0x39FF14);
                ringMesh.material.color.setHex(0x39FF14);
                ringMesh.material.emissive.setHex(0x118811);
                
                score++;
                
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SCORE_UPDATE', score: score }));
                }

                setTimeout(() => {
                    if (gameState === 'RESULT') prepareRound();
                }, 2000);
                
            } else {
                resultTimeDisplay.style.color = "#FF0055"; 
                resultTimeDisplay.style.textShadow = "0px 0px 20px rgba(255,0,85,0.6)";
                
                coreMesh.material.color.setHex(0xFF0055);
                ringMesh.material.color.setHex(0xFF0055);
                ringMesh.material.emissive.setHex(0x880022);
                
                setTimeout(() => {
                    triggerGameOver(elapsed.toFixed(2));
                }, 1500);
            }
        }

        function triggerGameOver(finalTimeStr) {
            gameState = 'GAMEOVER';
            
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'GAME_OVER', score: score }));
            }
        }

        function fullReset() {
            score = 0;
            gameOverScreen.style.display = 'none';
            prepareRound();
            
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'RESTART' }));
            }
        }

        function animate() {
            requestAnimationFrame(animate);

            coreMesh.rotation.y += 0.01;
            coreMesh.rotation.x += 0.005;
            
            if (gameState === 'WAITING') {
                ringMesh.rotation.z += 0.005;
            } 
            else if (gameState === 'RUNNING') {
                ringMesh.rotation.z += 0.05;
                coreMesh.rotation.y += 0.04;
                
                const elapsed = (Date.now() - startTime) / 1000;
                
                if (elapsed < targetTime / 2) {
                    let progress = elapsed / targetTime; 
                    sandTop.style.height = (100 - (progress * 100)) + '%';
                    sandBottom.style.height = (progress * 100) + '%';
                } else {
                    hourglass.style.display = 'none';
                }
            } 
            else if (gameState === 'RESULT') {
                ringMesh.rotation.z += 0.01;
            }

            renderer.render(scene, camera);
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        init();
    </script>
</body>
</html>
`;

export default function StopTheClockScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'StopTheClock'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'StopTheClock'>>();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  return (
    <SafeAreaView style={gameStyles.safeArea}>
      <StatusBar hidden={true} />

      <BlurView intensity={40} tint="dark" style={gameStyles.header}>
        <TouchableOpacity style={gameStyles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={gameStyles.headerTitle}>STOP THE CLOCK</Text>
        <View style={gameStyles.scoreBox}>
          <Text style={gameStyles.scoreText}>ARCADE</Text>
        </View>
      </BlurView>

      <View style={gameStyles.container}>
        <PreGameModal
          visible={!isPlaying}
          title="MISSION BRIEFING // STOP THE CLOCK"
          description="Fidati del tuo orologio interno.\n\nTocca per far scorrere la clessidra e tocca di nuovo per fermarla esattamente al secondo richiesto.\n\nAttenzione: a metà del tempo la clessidra sparirà, lasciandoti completamente al buio!"
          iconName="hourglass"
          onStart={() => setIsPlaying(true)}
          onBack={() => navigation.goBack()}
        />

        {isPlaying && (
          <ArcadeGameWebView
            htmlContent={htmlGameContent}
            gameId="StopTheClock"
            routeParams={route.params}
            onExit={() => navigation.goBack()}
            onRestart={() => setIsPlaying(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

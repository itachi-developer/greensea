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
    <title>3D Shape Smist Cyberpunk</title>
    <style>
        body, html { 
            margin: 0; padding: 0; 
            background-color: #050a1f; 
            overflow: hidden; touch-action: none; font-family: sans-serif; 
        }
        #game-container { width: 100vw; height: 100vh; display: block; }
        
        #hud { position: absolute; top: 80px; left: 0; width: 100%; text-align: center; color: rgba(255,255,255,0.9); font-size: 60px; font-weight: 900; z-index: 10; pointer-events: none; text-shadow: 0px 0px 20px rgba(0,229,255,0.8); }
        
        .indicator { position: absolute; font-size: 20px; font-weight: 900; z-index: 10; pointer-events: none; letter-spacing: 2px; }
        #ind-left { bottom: 40px; left: 20px; color: #FF0055; text-shadow: 0px 0px 10px #FF0055; }
        #ind-right { bottom: 40px; right: 20px; color: #00E5FF; text-shadow: 0px 0px 10px #00E5FF; }
        #ind-down { bottom: 20px; left: 50%; transform: translateX(-50%); color: #FFD700; text-shadow: 0px 0px 10px #FFD700; }
        
        #game-over { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(5, 10, 31, 0.85); color: white; display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 20; backdrop-filter: blur(10px); }
        h1 { font-size: 54px; color: #FF0055; margin-bottom: 10px; text-shadow: 0px 0px 20px #FF0055; margin-top: 0; }
        h2 { font-size: 24px; color: #fff; margin-bottom: 30px; }
        
        .start-btn {
            background: #00E5FF;
            color: #050a1f;
            font-size: 22px;
            font-weight: 900;
            padding: 16px 40px;
            border: none;
            border-radius: 12px;
            box-shadow: 0px 0px 20px #00E5FF;
            cursor: pointer;
            letter-spacing: 2px;
            pointer-events: auto;
        }
        .start-btn:active { transform: scale(0.95); }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
</head>
<body>
    <div id="hud">0</div>
    
    <div id="ind-left">⬅ CUBI</div>
    <div id="ind-down">⬇ TRIANGOLI</div>
    <div id="ind-right">SFERE ➡</div>

    <div id="game-over">
        <h1>CRASH!</h1>
        <h2 id="final-score">Punteggio: 0</h2>
        <button id="restart-btn" class="start-btn">RIAVVIA</button>
    </div>
    <div id="game-container"></div>
    
    <script>
        const container = document.getElementById('game-container');
        const hud = document.getElementById('hud');
        const gameOverScreen = document.getElementById('game-over');
        
        let scene, camera, renderer;
        let gridHelper;
        
        let gameState = 'PLAYING';
        let score = 0;
        
        let speedZ = 0.25; 
        let maxSpeedZ = 0.55; 
        let spawnTimer = 0;
        let spawnRate = 120; 
        
        let activeShapes = [];
        let clearedShapes = []; 
        
        const cubeMat = new THREE.MeshStandardMaterial({ color: 0xFF0055, roughness: 0.2, metalness: 0.8, emissive: 0x550022 });
        const sphereMat = new THREE.MeshStandardMaterial({ color: 0x00E5FF, roughness: 0.2, metalness: 0.8, emissive: 0x004466 });
        const triangleMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.2, metalness: 0.8, emissive: 0x665500 });
        
        const cubeGeo = new THREE.BoxGeometry(2, 2, 2);
        const sphereGeo = new THREE.IcosahedronGeometry(1.3, 2);
        const triangleGeo = new THREE.ConeGeometry(1.5, 2.5, 4);

        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x050a1f);
            scene.fog = new THREE.FogExp2(0x050a1f, 0.035);

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
            camera.position.set(0, 5, 8); 
            camera.lookAt(0, 0, -10);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
            scene.add(ambientLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
            dirLight.position.set(0, 20, 10);
            scene.add(dirLight);

            gridHelper = new THREE.GridHelper(40, 40, 0x00E5FF, 0x004466);
            gridHelper.position.y = -1.5;
            scene.add(gridHelper);

            const zoneGeo = new THREE.PlaneGeometry(6, 4);
            const zoneMat = new THREE.MeshBasicMaterial({ color: 0x39FF14, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
            const zone = new THREE.Mesh(zoneGeo, zoneMat);
            zone.rotation.x = -Math.PI / 2;
            zone.position.set(0, -1.4, 0);
            scene.add(zone);

            setupSwipe();

            document.getElementById('restart-btn').addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                resetGame();
            });

            window.addEventListener('resize', onWindowResize);
            animate();
        }

        function spawnShape() {
            const rand = Math.random();
            let geo, mat, type;
            
            if (rand < 0.33) {
                geo = cubeGeo; mat = cubeMat; type = 'CUBE';
            } else if (rand < 0.66) {
                geo = sphereGeo; mat = sphereMat; type = 'SPHERE';
            } else {
                geo = triangleGeo; mat = triangleMat; type = 'TRIANGLE';
            }
            
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, 0.5, -40);
            scene.add(mesh);
            
            activeShapes.push({
                mesh: mesh,
                type: type,
                rotSpeedX: (Math.random() - 0.5) * 0.1,
                rotSpeedY: (Math.random() - 0.5) * 0.1
            });
        }

        function setupSwipe() {
            let startX = 0;
            let startY = 0;

            container.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }, { passive: false });

            container.addEventListener('touchend', (e) => {
                if (gameState !== 'PLAYING') return;

                let endX = e.changedTouches[0].clientX;
                let endY = e.changedTouches[0].clientY;

                let dx = endX - startX;
                let dy = endY - startY;

                if (Math.abs(dx) > Math.abs(dy)) {
                    if (Math.abs(dx) > 30) {
                        handleSwipe(dx > 0 ? 'RIGHT' : 'LEFT');
                    }
                } else {
                    if (dy > 30) {
                        handleSwipe('DOWN');
                    }
                }
            });
        }

        function handleSwipe(direction) {
            if (activeShapes.length === 0) return;
            
            let targetShape = activeShapes[0];
            if (targetShape.mesh.position.z < -10) return;

            let isCorrect = false;
            if (direction === 'LEFT' && targetShape.type === 'CUBE') isCorrect = true;
            if (direction === 'RIGHT' && targetShape.type === 'SPHERE') isCorrect = true;
            if (direction === 'DOWN' && targetShape.type === 'TRIANGLE') isCorrect = true;

            if (isCorrect) {
                score++;
                hud.innerText = score;
                
                speedZ += 0.005; 
                if (speedZ > maxSpeedZ) speedZ = maxSpeedZ;
                
                spawnRate = Math.max(45, 120 - Math.floor(score * 1.5)); 

                activeShapes.shift(); 
                
                targetShape.vx = direction === 'LEFT' ? -1 : (direction === 'RIGHT' ? 1 : 0);
                targetShape.vy = direction === 'DOWN' ? -1 : 0;
                targetShape.vz = speedZ * 1.5; 
                
                clearedShapes.push(targetShape);
                
            } else {
                triggerGameOver();
            }
        }

        function triggerGameOver() {
            gameState = 'GAMEOVER';
            
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(score.toString());
            }
        }

        function resetGame() {
            score = 0;
            speedZ = 0.25;
            spawnRate = 120;
            spawnTimer = 0;
            hud.innerText = score;
            
            activeShapes.forEach(s => scene.remove(s.mesh));
            clearedShapes.forEach(s => scene.remove(s.mesh));
            activeShapes = [];
            clearedShapes = [];
            
            gameOverScreen.style.display = 'none';
            gameState = 'PLAYING';

            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('RESTART');
            }
        }

        function animate() {
            requestAnimationFrame(animate);

            if (gameState === 'PLAYING') {
                spawnTimer++;
                if (spawnTimer > spawnRate) {
                    spawnShape();
                    spawnTimer = 0;
                }

                for (let i = 0; i < activeShapes.length; i++) {
                    let shape = activeShapes[i];
                    shape.mesh.position.z += speedZ;
                    shape.mesh.rotation.x += shape.rotSpeedX;
                    shape.mesh.rotation.y += shape.rotSpeedY;
                    
                    if (shape.mesh.position.z > 8) {
                        triggerGameOver();
                        break;
                    }
                }

                for (let i = clearedShapes.length - 1; i >= 0; i--) {
                    let shape = clearedShapes[i];
                    shape.mesh.position.x += shape.vx;
                    shape.mesh.position.y += shape.vy;
                    shape.mesh.position.z += shape.vz;
                    shape.mesh.rotation.z -= shape.vx * 0.2;
                    
                    if (Math.abs(shape.mesh.position.x) > 15 || shape.mesh.position.y < -10) {
                        scene.remove(shape.mesh);
                        clearedShapes.splice(i, 1);
                    }
                }

                gridHelper.position.z = (gridHelper.position.z + speedZ) % 2;
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

export default function ShapeSmistScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ShapeSmist'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ShapeSmist'>>();
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

      <BlurView intensity={80} tint="dark" style={gameStyles.header}>
        <TouchableOpacity style={gameStyles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={gameStyles.headerTitle}>SHAPE SMIST 3D</Text>
        <View style={gameStyles.scoreBox}>
          <Text style={gameStyles.scoreText}>ARCADE</Text>
        </View>
      </BlurView>

      <View style={gameStyles.container}>
        <PreGameModal
          visible={!isPlaying}
          title="MISSION BRIEFING // SHAPE SMIST"
          description="Le forme stanno correndo verso di te.\n\nAppena entrano nella zona luminosa, fai swipe col dito:\n• SINISTRA per i Cubi rossi.\n• DESTRA per le Sfere blu.\n• IN BASSO per i Triangoli oro.\n\nUn errore di direzione manderà in crash il sistema."
          iconName="shapes"
          onStart={() => setIsPlaying(true)}
          onBack={() => navigation.goBack()}
        />

        {isPlaying && (
          <ArcadeGameWebView
            htmlContent={htmlGameContent}
            gameId="ShapeSmist"
            routeParams={route.params}
            onExit={() => navigation.goBack()}
            onRestart={() => setIsPlaying(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

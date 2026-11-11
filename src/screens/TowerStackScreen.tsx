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
    <title>3D Cyber Tower Stack</title>
    <style>
        body, html { 
            margin: 0; padding: 0; 
            background: linear-gradient(135deg, #050B14 0%, #1A0B2E 100%);
            overflow: hidden; touch-action: none; font-family: sans-serif; 
        }
        #game-container { width: 100vw; height: 100vh; display: block; }
        #hud { position: absolute; top: 50px; left: 0; width: 100%; text-align: center; color: rgba(255,255,255,0.8); font-size: 70px; font-weight: 900; z-index: 10; pointer-events: none; text-shadow: 0px 0px 20px rgba(0,229,255,0.6); }
        
        #game-over { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(5, 11, 20, 0.85); color: white; display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 20; backdrop-filter: blur(10px); }
        h1 { font-size: 64px; color: #FF0055; margin-bottom: 10px; text-shadow: 0px 4px 20px #FF0055; margin-top: 0; }
        h2 { font-size: 24px; color: #fff; text-shadow: 0px 2px 5px rgba(0,0,0,0.2); margin-bottom: 30px; }
        
        .start-btn {
            background: #00E5FF;
            color: #050B14;
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
        .start-btn:active {
            transform: scale(0.95);
            box-shadow: 0px 0px 10px #00E5FF;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
</head>
<body>
    <div id="hud">0</div>
    <div id="game-over">
        <h1>CRASH!</h1>
        <h2 id="final-score">Punteggio: 0</h2>
        <button id="restart-btn" class="start-btn">START</button>
    </div>
    <div id="game-container"></div>
    
    <script>
        const container = document.getElementById('game-container');
        const hud = document.getElementById('hud');
        const gameOverScreen = document.getElementById('game-over');
        
        let scene, camera, renderer;
        
        let gameState = 'PLAYING';
        let score = 0;
        
        const blockHeight = 1;
        const originalWidth = 4;
        const originalDepth = 4;
        
        let stack = [];     
        let debris = [];    
        
        let activeBlock;
        let activeAxis = 'x'; 
        let activeDirection = 1;
        let speed = 0.15;
        
        let cameraTargetY = 0;

        function init() {
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x1A0B2E, 0.02);

            const aspect = window.innerWidth / window.innerHeight;
            const d = 10;
            camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 100);
            camera.position.set(10, 10, 10); 
            camera.lookAt(0, 0, 0);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(5, 15, 10);
            scene.add(dirLight);

            const gridHelper = new THREE.GridHelper(30, 30, 0x00E5FF, 0x002244);
            gridHelper.position.y = -0.5;
            scene.add(gridHelper);

            container.addEventListener('pointerdown', (e) => {
                if (gameState === 'PLAYING') {
                    placeBlock();
                }
            });

            document.getElementById('restart-btn').addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                resetGame();
            });

            window.addEventListener('resize', onWindowResize);
            
            startGame();
            animate();
        }

        function getNeonColor(level) {
            const hue = (level * 12) % 360; 
            const color = new THREE.Color('hsl(' + hue + ', 100%, 50%)');
            return color;
        }

        function createBlock(width, depth, y, x, z, color) {
            const geo = new THREE.BoxGeometry(width, blockHeight, depth);
            const mat = new THREE.MeshStandardMaterial({ 
                color: color, 
                roughness: 0.1, 
                metalness: 0.5,
                emissive: color,
                emissiveIntensity: 0.4
            });
            const mesh = new THREE.Mesh(geo, mat);
            
            const wireGeo = new THREE.EdgesGeometry(geo);
            const wireMat = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3 });
            const wireframe = new THREE.LineSegments(wireGeo, wireMat);
            mesh.add(wireframe);
            
            mesh.position.set(x, y, z);
            scene.add(mesh);
            return mesh;
        }

        function startGame() {
            stack.forEach(b => scene.remove(b));
            debris.forEach(d => scene.remove(d.mesh));
            stack = [];
            debris = [];
            
            score = 0;
            speed = 0.15;
            cameraTargetY = 0;
            camera.position.set(10, 10, 10);
            camera.lookAt(0, 0, 0);
            hud.innerText = score;
            
            const baseColor = getNeonColor(0);
            const baseBlock = createBlock(originalWidth, originalDepth, 0, 0, 0, baseColor);
            stack.push({
                mesh: baseBlock,
                width: originalWidth,
                depth: originalDepth
            });

            spawnNextBlock();
        }

        function spawnNextBlock() {
            const lastBlock = stack[stack.length - 1];
            const nextLevel = stack.length;
            const newColor = getNeonColor(nextLevel);
            
            activeAxis = (nextLevel % 2 === 0) ? 'z' : 'x';
            activeDirection = (Math.random() > 0.5 ? 1 : -1);
            
            const startX = activeAxis === 'x' ? 15 * activeDirection : lastBlock.mesh.position.x;
            const startZ = activeAxis === 'z' ? 15 * activeDirection : lastBlock.mesh.position.z;
            
            activeBlock = {
                mesh: createBlock(lastBlock.width, lastBlock.depth, nextLevel * blockHeight, startX, startZ, newColor),
                width: lastBlock.width,
                depth: lastBlock.depth,
                color: newColor
            };
            
            cameraTargetY = (nextLevel * blockHeight) - 2; 
            if (cameraTargetY < 0) cameraTargetY = 0;
        }

        function triggerGameOver() {
            gameState = 'GAMEOVER';
            
            scene.remove(activeBlock.mesh);
            const fallingGeo = new THREE.BoxGeometry(activeBlock.width, blockHeight, activeBlock.depth);
            const fallingMat = new THREE.MeshStandardMaterial({ color: activeBlock.color });
            const fallingMesh = new THREE.Mesh(fallingGeo, fallingMat);
            fallingMesh.position.copy(activeBlock.mesh.position);
            scene.add(fallingMesh);
            
            debris.push({
                mesh: fallingMesh,
                vy: 0,
                rx: Math.random() * 0.1 - 0.05,
                rz: Math.random() * 0.1 - 0.05
            });

            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(score.toString());
            }
        }

        function resetGame() {
            gameOverScreen.style.display = 'none';
            gameState = 'PLAYING';
            startGame();

            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('RESTART');
            }
        }

        function placeBlock() {
            const lastBlock = stack[stack.length - 1];
            const currentMesh = activeBlock.mesh;
            
            const delta = currentMesh.position[activeAxis] - lastBlock.mesh.position[activeAxis];
            const size = activeAxis === 'x' ? activeBlock.width : activeBlock.depth;
            const absoluteDelta = Math.abs(delta);
            
            if (absoluteDelta > size) {
                triggerGameOver();
                return;
            }

            if (absoluteDelta < 0.2) {
                currentMesh.position[activeAxis] = lastBlock.mesh.position[activeAxis];
                stack.push({
                    mesh: currentMesh,
                    width: activeBlock.width,
                    depth: activeBlock.depth
                });
                
                currentMesh.material.emissive.setHex(0xFFFFFF);
                setTimeout(() => {
                    if(currentMesh) currentMesh.material.emissive.copy(activeBlock.color);
                }, 200);

            } else {
                const choppedSize = size - absoluteDelta;
                const fallingSize = absoluteDelta;
                
                const choppedPosition = lastBlock.mesh.position[activeAxis] + (delta / 2);
                
                const fallingOffset = (choppedSize / 2 + fallingSize / 2) * Math.sign(delta);
                const fallingPosition = choppedPosition + fallingOffset;

                scene.remove(currentMesh);

                const newWidth = activeAxis === 'x' ? choppedSize : activeBlock.width;
                const newDepth = activeAxis === 'z' ? choppedSize : activeBlock.depth;
                
                const xPos = activeAxis === 'x' ? choppedPosition : currentMesh.position.x;
                const zPos = activeAxis === 'z' ? choppedPosition : currentMesh.position.z;
                
                const choppedMesh = createBlock(newWidth, newDepth, currentMesh.position.y, xPos, zPos, activeBlock.color);
                
                stack.push({
                    mesh: choppedMesh,
                    width: newWidth,
                    depth: newDepth
                });

                const fallingWidth = activeAxis === 'x' ? fallingSize : activeBlock.width;
                const fallingDepth = activeAxis === 'z' ? fallingSize : activeBlock.depth;
                const fallX = activeAxis === 'x' ? fallingPosition : currentMesh.position.x;
                const fallZ = activeAxis === 'z' ? fallingPosition : currentMesh.position.z;
                
                const fallGeo = new THREE.BoxGeometry(fallingWidth, blockHeight, fallingDepth);
                const fallMat = new THREE.MeshStandardMaterial({ 
                    color: activeBlock.color, emissive: activeBlock.color, emissiveIntensity: 0.4 
                });
                const fallMesh = new THREE.Mesh(fallGeo, fallMat);
                fallMesh.position.set(fallX, currentMesh.position.y, fallZ);
                scene.add(fallMesh);
                
                debris.push({
                    mesh: fallMesh,
                    vy: 0,
                    rx: activeAxis === 'z' ? (Math.sign(delta) * 0.1) : 0,
                    rz: activeAxis === 'x' ? (-Math.sign(delta) * 0.1) : 0
                });
            }

            score++;
            hud.innerText = score;
            speed += 0.005; 
            if(speed > 0.4) speed = 0.4; 
            
            spawnNextBlock();
        }

        function animate() {
            requestAnimationFrame(animate);

            if (gameState === 'PLAYING' && activeBlock) {
                activeBlock.mesh.position[activeAxis] -= speed * activeDirection;
                
                if (activeBlock.mesh.position[activeAxis] > 15 || activeBlock.mesh.position[activeAxis] < -15) {
                    activeDirection *= -1;
                }
            }

            for (let i = debris.length - 1; i >= 0; i--) {
                let d = debris[i];
                d.vy += 0.015; 
                d.mesh.position.y -= d.vy;
                d.mesh.rotation.x += d.rx;
                d.mesh.rotation.z += d.rz;
                
                if (d.mesh.position.y < -20) {
                    scene.remove(d.mesh);
                    debris.splice(i, 1);
                }
            }

            if (camera) {
                camera.position.y += (10 + cameraTargetY - camera.position.y) * 0.1;
                camera.lookAt(0, cameraTargetY, 0);
            }

            renderer.render(scene, camera);
        }

        function onWindowResize() {
            const aspect = window.innerWidth / window.innerHeight;
            const d = 10;
            camera.left = -d * aspect;
            camera.right = d * aspect;
            camera.top = d;
            camera.bottom = -d;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        init();
    </script>
</body>
</html>
`;

export default function TowerStackScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'TowerStack'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TowerStack'>>();
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
          <Ionicons name="chevron-back" size={24} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={gameStyles.headerTitle}>TOWER STACK</Text>
        <View style={gameStyles.scoreBox}>
          <Text style={gameStyles.scoreText}>ARCADE</Text>
        </View>
      </BlurView>

      <View style={gameStyles.container}>
        <PreGameModal
          visible={!isPlaying}
          title="MISSION BRIEFING // TOWER STACK"
          description="Tocca lo schermo al momento giusto per allineare perfettamente i blocchi.\n\nGli eccessi verranno tagliati via, riducendo la tua base d'appoggio. Posizionali con estrema precisione per mantenerli larghi e sicuri!"
          iconName="layers"
          onStart={() => setIsPlaying(true)}
          onBack={() => navigation.goBack()}
        />

        {isPlaying && (
          <ArcadeGameWebView
            htmlContent={htmlGameContent}
            gameId="TowerStack"
            routeParams={route.params}
            onExit={() => navigation.goBack()}
            onRestart={() => setIsPlaying(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

import React, { useState, useEffect } from 'react';
import { Text, View, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
    <title>3D Gravity Runner</title>
    <style>
        body, html { margin: 0; padding: 0; background-color: #050a1f; overflow: hidden; touch-action: none; font-family: sans-serif; }
        #game-container { width: 100vw; height: 100vh; display: block; }
        #hud { position: absolute; top: 20px; right: 20px; color: #00E5FF; font-size: 24px; font-weight: 900; text-shadow: 0px 0px 10px #00E5FF; z-index: 10; pointer-events: none; }
        #game-over { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(5, 10, 31, 0.85); color: white; display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 20; }
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
        .start-btn:active {
            transform: scale(0.95);
            box-shadow: 0px 0px 10px #00E5FF;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
</head>
<body>
    <div id="hud">0 PTS</div>
    <div id="game-over">
        <h1>CRASH!</h1>
        <h2 id="final-score">Punteggio finale: 0</h2>
        <button id="restart-btn" class="start-btn">START</button>
    </div>
    <div id="game-container"></div>
    
    <script>
        const container = document.getElementById('game-container');
        const hud = document.getElementById('hud');
        const gameOverScreen = document.getElementById('game-over');
        
        let scene, camera, renderer;
        let player;
        let obstacles = [];
        let buildings = [];
        let floorGrid, ceilingGrid;
        
        let gameState = 'PLAYING';
        let score = 0;
        let speed = 0.35; 
        
        const laneWidth = 4;
        let currentLane = 0; 
        let targetX = 0;
        
        const floorY = 0.75;
        const ceilingY = 9.25; 
        let isCeiling = false;
        let targetY = floorY;

        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x050a1f);
            scene.fog = new THREE.Fog(0x050a1f, 10, 100);

            camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 5, -8);
            camera.lookAt(0, 5, 20);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(-10, 20, -10);
            scene.add(dirLight);

            const playerGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
            const playerMat = new THREE.MeshStandardMaterial({ color: 0x39FF14, roughness: 0.1, metalness: 0.8, emissive: 0x114400 });
            player = new THREE.Mesh(playerGeo, playerMat);
            player.position.set(0, floorY, 0);
            scene.add(player);

            const floorMat = new THREE.MeshStandardMaterial({ color: 0x051024, roughness: 0.9 });
            const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x1a051f, roughness: 0.9 });

            const planeGeo = new THREE.PlaneGeometry(30, 250);
            const floor = new THREE.Mesh(planeGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.z = 100;
            scene.add(floor);

            const ceiling = new THREE.Mesh(planeGeo, ceilingMat);
            ceiling.rotation.x = Math.PI / 2;
            ceiling.position.y = 10;
            ceiling.position.z = 100;
            scene.add(ceiling);

            floorGrid = new THREE.GridHelper(30, 30, 0x00E5FF, 0x004466);
            floorGrid.position.set(0, 0.02, 20);
            scene.add(floorGrid);

            ceilingGrid = new THREE.GridHelper(30, 30, 0xB026FF, 0x440066);
            ceilingGrid.position.set(0, 9.98, 20);
            ceilingGrid.rotation.x = Math.PI; 
            scene.add(ceilingGrid);

            const borderGeo = new THREE.BoxGeometry(0.5, 0.2, 250);
            const floorBorderMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF });
            const ceilBorderMat = new THREE.MeshBasicMaterial({ color: 0xB026FF });

            let leftBorderFloor = new THREE.Mesh(borderGeo, floorBorderMat); leftBorderFloor.position.set(7.5, 0.1, 100); scene.add(leftBorderFloor);
            let rightBorderFloor = new THREE.Mesh(borderGeo, floorBorderMat); rightBorderFloor.position.set(-7.5, 0.1, 100); scene.add(rightBorderFloor);
            let leftBorderCeil = new THREE.Mesh(borderGeo, ceilBorderMat); leftBorderCeil.position.set(7.5, 9.9, 100); scene.add(leftBorderCeil);
            let rightBorderCeil = new THREE.Mesh(borderGeo, ceilBorderMat); rightBorderCeil.position.set(-7.5, 9.9, 100); scene.add(rightBorderCeil);

            generateCity();
            setupSwipeControls();
            
            document.getElementById('restart-btn').addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                resetGame();
            });

            window.addEventListener('resize', onWindowResize);
            animate();
        }

        function generateCity() {
            const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
            const bldgMat = new THREE.MeshPhongMaterial({ color: 0x000000, emissive: 0x0088FF, emissiveIntensity: 0.6, wireframe: true, transparent: true, opacity: 0.5 });
            for (let i = 0; i < 40; i++) {
                const bldg = new THREE.Mesh(bldgGeo, bldgMat);
                const isLeft = Math.random() > 0.5;
                const xPos = isLeft ? (Math.random() * 20 + 12) : -(Math.random() * 20 + 12); 
                const zPos = Math.random() * 200;
                const width = Math.random() * 4 + 3;
                const height = Math.random() * 30 + 10;
                const depth = Math.random() * 4 + 3;
                
                bldg.scale.set(width, height, depth);
                bldg.position.set(xPos, height/2 - 2, zPos);
                scene.add(bldg);
                buildings.push(bldg);
            }
        }

        function setupSwipeControls() {
            let touchStartX = 0;
            let touchStartY = 0;

            window.addEventListener('touchstart', (e) => {
                touchStartX = e.touches ? e.touches[0].clientX : e.clientX;
                touchStartY = e.touches ? e.touches[0].clientY : e.clientY;
            }, { passive: false });

            window.addEventListener('touchend', (e) => {
                if (gameState !== 'PLAYING') return; 

                let touchEndX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
                let touchEndY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

                let dx = touchEndX - touchStartX;
                let dy = touchEndY - touchStartY;

                if (Math.abs(dx) > Math.abs(dy)) {
                    if (Math.abs(dx) > 30) {
                        if (dx > 0 && currentLane > -1) currentLane--; 
                        else if (dx < 0 && currentLane < 1) currentLane++; 
                    }
                } else {
                    if (Math.abs(dy) > 30) {
                        if (dy < 0 && !isCeiling) isCeiling = true;
                        else if (dy > 0 && isCeiling) isCeiling = false;
                    }
                }
                
                targetX = currentLane * laneWidth;
                targetY = isCeiling ? ceilingY : floorY;
            });
        }

        function spawnObstacle() {
            const lane = (Math.floor(Math.random() * 3) - 1) * laneWidth;
            const onCeiling = Math.random() > 0.5; 
            const type = Math.random();
            let obsGeo, obsMat, yPos;
            
            if (type > 0.9) { 
                obsGeo = new THREE.BoxGeometry(15, 3, 1);
                obsMat = new THREE.MeshStandardMaterial({ color: 0xFF0055, emissive: 0x880022 });
                yPos = onCeiling ? 8.5 : 1.5;
                const obs = new THREE.Mesh(obsGeo, obsMat);
                obs.position.set(0, yPos, 120); 
                obs.geometry.computeBoundingBox();
                scene.add(obs);
                obstacles.push(obs);
                return; 
            }
            
            if (type > 0.4) {
                obsGeo = new THREE.BoxGeometry(3, 4, 1.5);
                obsMat = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
                yPos = onCeiling ? 8 : 2;
            } else {
                obsGeo = new THREE.ConeGeometry(1.8, 3.5, 4);
                obsMat = new THREE.MeshStandardMaterial({ color: 0xFF6600 });
                yPos = onCeiling ? 8.25 : 1.75;
            }

            const obs = new THREE.Mesh(obsGeo, obsMat);
            obs.position.set(lane, yPos, 120);
            if (onCeiling && type <= 0.4) obs.rotation.x = Math.PI; 
            
            obs.geometry.computeBoundingBox();
            scene.add(obs);
            obstacles.push(obs);
        }

        function triggerGameOver() {
            // Ferma la logica del gioco (fisica, ostacoli, ecc.)
            gameState = 'GAMEOVER';
            
            // Rimosse le vecchie schermate HTML interne
            // gameOverScreen.style.display = 'flex';
            // document.getElementById('final-score').innerText = 'Punteggio finale: ' + Math.floor(score);
            
            // Comunica immediatamente il punteggio all'app React Native per aprire il modale globale
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(Math.floor(score).toString());
            }
        }

        function resetGame() {
            score = 0;
            speed = 0.35; 
            currentLane = 0;
            targetX = 0;
            isCeiling = false;
            targetY = floorY;
            
            player.position.set(0, floorY, 0);
            obstacles.forEach(obs => scene.remove(obs));
            obstacles = [];
            
            gameOverScreen.style.display = 'none';
            gameState = 'PLAYING';
            
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('RESTART');
            }
        }

        let frameCounter = 0;
        
        function animate() {
            requestAnimationFrame(animate);

            if (gameState === 'PLAYING') {
                score += 0.2;
                speed = 0.35 + (score * 0.001); 
                if (speed > 2.0) speed = 2.0; 
                
                hud.innerText = Math.floor(score) + ' PTS';

                player.position.x += (targetX - player.position.x) * 0.2;
                player.position.y += (targetY - player.position.y) * 0.2;
                
                const rotSpeed = isCeiling ? -speed : speed;
                player.rotation.x += rotSpeed * 0.15;
                player.rotation.z = (player.position.x - targetX) * 0.25; 

                floorGrid.position.z -= speed;
                if (floorGrid.position.z < 0) floorGrid.position.z += 10;
                ceilingGrid.position.z -= speed;
                if (ceilingGrid.position.z < 0) ceilingGrid.position.z += 10;

                buildings.forEach(bldg => {
                    bldg.position.z -= speed * 0.8; 
                    if (bldg.position.z < -20) bldg.position.z = 180 + Math.random() * 40;
                });

                frameCounter++;
                const spawnRate = Math.max(30, 90 - Math.floor(score / 15));
                if (frameCounter > spawnRate) {
                    spawnObstacle();
                    frameCounter = 0;
                }

                for (let i = obstacles.length - 1; i >= 0; i--) {
                    obstacles[i].position.z -= speed;
                    if (obstacles[i].position.z < -10) {
                        scene.remove(obstacles[i]);
                        obstacles.splice(i, 1);
                    }
                }

                const playerBox = new THREE.Box3().setFromObject(player);
                playerBox.expandByScalar(-0.35);
                
                for (let i = 0; i < obstacles.length; i++) {
                    const obsBox = new THREE.Box3().setFromObject(obstacles[i]);
                    if (playerBox.intersectsBox(obsBox)) {
                        triggerGameOver();
                        break;
                    }
                }
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

export default function GravityRunnerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GravityRunner'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GravityRunner'>>();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
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
        <Text style={gameStyles.headerTitle}>GRAVITY RUNNER 3D</Text>
        <View style={gameStyles.scoreBox}>
          <Text style={gameStyles.scoreText}>ARCADE</Text>
        </View>
      </BlurView>

      <View style={gameStyles.container}>
        <PreGameModal
          visible={!isPlaying}
          title="GRAVITY RUNNER 3D"
          description="Scorri a DESTRA o SINISTRA per cambiare corsia ed evitare gli ostacoli poligonali. Attenzione ai MURI LASER rossi: coprono tutta la pista! Scorri IN SU per invertire la gravità e correre sul soffitto, e IN GIÙ per tornare al pavimento."
          iconName="swap-vertical"
          onStart={() => setIsPlaying(true)}
          onBack={() => navigation.goBack()}
        />

        {isPlaying && (
          <ArcadeGameWebView
            htmlContent={htmlGameContent}
            gameId="GravityRunner"
            routeParams={route.params}
            onExit={() => navigation.goBack()}
            onRestart={() => setIsPlaying(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

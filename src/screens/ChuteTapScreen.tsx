import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, TouchableOpacity, Text, View } from 'react-native';
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
    <title>3D Chute Tap (Flappy)</title>
    <style>
        body, html { 
            margin: 0; padding: 0; 
            background: linear-gradient(to bottom, #001f3f 0%, #000511 100%);
            overflow: hidden; touch-action: none; font-family: sans-serif; 
        }
        #game-container { width: 100vw; height: 100vh; display: block; }
        #hud { position: absolute; top: 20px; right: 30px; text-align: right; color: #FFF; font-size: 38px; font-weight: 900; text-shadow: 0px 4px 10px rgba(0,229,255,0.8); z-index: 10; pointer-events: none; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
</head>
<body>
    <div id="hud">0 PTS</div>
    <div id="game-container"></div>
    
    <script>
        const container = document.getElementById('game-container');
        const hud = document.getElementById('hud');
        
        let scene, camera, renderer;
        let playerGroup, playerCore, thrusterLight;
        let obstacles = [];
        let particles = [];
        let floorGrid, ceilGrid;
        
        let gameState = 'PLAYING';
        let score = 0;
        let frameCounter = 0;
        let gameSpeed = 0.12; 
        
        let playerPhysics = {
            y: 0,
            vy: 0,
            gravity: 0.008,   
            lift: 0.018, 
            terminalVelocity: 0.25,
            isHolding: false
        };

        function init() {
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x000511, 0.015); 

            camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
            camera.position.set(0, 0, 25); 
            camera.lookAt(0, 0, 0);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(renderer.domElement);

            const hemiLight = new THREE.HemisphereLight(0x00E5FF, 0xFF0055, 1);
            scene.add(hemiLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
            dirLight.position.set(5, 10, 15);
            scene.add(dirLight);

            playerGroup = new THREE.Group();
            playerGroup.position.set(-10, 0, 0); 

            const playerGeo = new THREE.OctahedronGeometry(1.2, 0);
            const playerMat = new THREE.MeshStandardMaterial({ 
                color: 0x00E5FF, emissive: 0x004488, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.8 
            });
            playerCore = new THREE.Mesh(playerGeo, playerMat);
            
            const wireGeo = new THREE.OctahedronGeometry(1.3, 0);
            const wireMat = new THREE.MeshBasicMaterial({ color: 0x39FF14, wireframe: true, transparent: true, opacity: 0.5 });
            const playerWire = new THREE.Mesh(wireGeo, wireMat);
            playerCore.add(playerWire);

            playerGroup.add(playerCore);
            
            thrusterLight = new THREE.PointLight(0x39FF14, 0, 5);
            thrusterLight.position.set(-1.5, 0, 0);
            playerGroup.add(thrusterLight);
            
            scene.add(playerGroup);

            floorGrid = new THREE.GridHelper(100, 50, 0xFF0055, 0x440011);
            floorGrid.position.set(0, -12, 0);
            scene.add(floorGrid);

            ceilGrid = new THREE.GridHelper(100, 50, 0x00E5FF, 0x001144);
            ceilGrid.position.set(0, 12, 0);
            ceilGrid.rotation.x = Math.PI; 
            scene.add(ceilGrid);

            const particleGeo = new THREE.BoxGeometry(0.2, 0.2, 5);
            const particleMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.3 });
            for(let i=0; i<40; i++) {
                let p = new THREE.Mesh(particleGeo, particleMat);
                p.position.set(
                    (Math.random() - 0.5) * 60, 
                    (Math.random() - 0.5) * 24, 
                    -5 - Math.random() * 10
                );
                p.userData = { speed: Math.random() * 0.2 + 0.1 };
                scene.add(p);
                particles.push(p);
            }

            window.addEventListener('pointerdown', () => {
                if (gameState === 'PLAYING') {
                    playerPhysics.isHolding = true;
                }
            });
            
            window.addEventListener('pointerup', () => { playerPhysics.isHolding = false; });
            window.addEventListener('pointercancel', () => { playerPhysics.isHolding = false; });

            window.addEventListener('resize', onWindowResize);
            animate();
        }

        function spawnObstacle() {
            const gapSize = 11; 
            const startY = -12; 
            const endY = 12;   
            const gapCenter = (Math.random() * 12) - 6; 
            
            const bottomHeight = (gapCenter - (gapSize / 2)) - startY;
            const topHeight = endY - (gapCenter + (gapSize / 2));

            const obsMat = new THREE.MeshStandardMaterial({ color: 0xFF0055, emissive: 0x550011, roughness: 0.2 });
            const obsGroup = new THREE.Group();

            if (bottomHeight > 0) {
                const bGeo = new THREE.BoxGeometry(3, bottomHeight, 3);
                const bMesh = new THREE.Mesh(bGeo, obsMat);
                bMesh.position.set(0, startY + (bottomHeight / 2), 0);
                obsGroup.add(bMesh);
            }

            if (topHeight > 0) {
                const tGeo = new THREE.BoxGeometry(3, topHeight, 3);
                const tMesh = new THREE.Mesh(tGeo, obsMat);
                tMesh.position.set(0, endY - (topHeight / 2), 0);
                obsGroup.add(tMesh);
            }

            obsGroup.position.set(25, 0, 0); 
            
            obsGroup.userData = {
                bottomBox: new THREE.Box3(),
                topBox: new THREE.Box3(),
                passed: false
            };

            scene.add(obsGroup);
            obstacles.push(obsGroup);
        }

        function triggerGameOver() {
            gameState = 'GAMEOVER';
            playerPhysics.isHolding = false;
            thrusterLight.intensity = 0;
            
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(Math.floor(score).toString());
            }
        }

        function resetGame() {
            score = 0;
            gameSpeed = 0.12; 
            hud.innerText = score + ' PTS';
            
            playerGroup.position.set(-10, 0, 0);
            playerPhysics.y = 0;
            playerPhysics.vy = 0;
            playerPhysics.isHolding = false;
            playerGroup.rotation.z = 0;
            
            obstacles.forEach(obs => scene.remove(obs));
            obstacles = [];
            frameCounter = 0;
            
            gameState = 'PLAYING';
        }

        function animate() {
            requestAnimationFrame(animate);

            if (gameState === 'PLAYING') {
                score += 0.1;
                gameSpeed = 0.12 + (score * 0.0002); 
                if (gameSpeed > 0.3) gameSpeed = 0.3; 
                hud.innerText = Math.floor(score) + ' PTS';

                if (playerPhysics.isHolding) {
                    playerPhysics.vy += playerPhysics.lift;
                    thrusterLight.intensity = 2;
                    playerGroup.rotation.z += (0.4 - playerGroup.rotation.z) * 0.1;
                } else {
                    playerPhysics.vy -= playerPhysics.gravity;
                    thrusterLight.intensity = 0;
                    playerGroup.rotation.z += (-0.4 - playerGroup.rotation.z) * 0.1;
                }

                playerCore.rotation.x += 0.05;

                if (playerPhysics.vy > playerPhysics.terminalVelocity) playerPhysics.vy = playerPhysics.terminalVelocity;
                if (playerPhysics.vy < -playerPhysics.terminalVelocity) playerPhysics.vy = -playerPhysics.terminalVelocity;

                playerPhysics.y += playerPhysics.vy;
                
                if (playerPhysics.y > 10.5) { playerPhysics.y = 10.5; playerPhysics.vy = 0; }
                if (playerPhysics.y < -10.5) { playerPhysics.y = -10.5; playerPhysics.vy = 0; }

                playerGroup.position.y = playerPhysics.y;

                floorGrid.position.x -= gameSpeed;
                if(floorGrid.position.x < -10) floorGrid.position.x = 0;
                ceilGrid.position.x -= gameSpeed;
                if(ceilGrid.position.x < -10) ceilGrid.position.x = 0;

                particles.forEach(p => {
                    p.position.x -= (gameSpeed + p.userData.speed);
                    if (p.position.x < -30) {
                        p.position.x = 30 + Math.random()*10;
                        p.position.y = (Math.random() - 0.5) * 24;
                    }
                });

                frameCounter++;
                let spawnRate = Math.max(75, 150 - Math.floor(score / 5)); 
                
                if (frameCounter > spawnRate) {
                    spawnObstacle();
                    frameCounter = 0;
                }

                const playerBox = new THREE.Box3().setFromObject(playerCore);
                playerBox.expandByScalar(-0.3); 

                for (let i = obstacles.length - 1; i >= 0; i--) {
                    let obs = obstacles[i];
                    obs.position.x -= gameSpeed;
                    
                    if (obs.children.length === 2) {
                        obs.userData.bottomBox.setFromObject(obs.children[0]);
                        obs.userData.topBox.setFromObject(obs.children[1]);
                    } else if (obs.children.length === 1) {
                        obs.userData.bottomBox.setFromObject(obs.children[0]);
                    }

                    if (playerBox.intersectsBox(obs.userData.bottomBox) || playerBox.intersectsBox(obs.userData.topBox)) {
                        triggerGameOver();
                        break;
                    }

                    if (obs.position.x < -20) {
                        scene.remove(obs);
                        obstacles.splice(i, 1);
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

export default function ChuteTapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChuteTap'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ChuteTap'>>();
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
        <Text style={gameStyles.headerTitle}>CHUTE TAP 3D</Text>
        <View style={gameStyles.scoreBox}>
          <Text style={gameStyles.scoreText}>ARCADE</Text>
        </View>
      </BlurView>

      <View style={gameStyles.container}>
        <PreGameModal
          visible={!isPlaying}
          title="CHUTE TAP 3D"
          description="Il drone 3D è in caduta libera costante. Tieni premuto lo schermo per accendere i propulsori e volare verso l'alto; rilascia per riprendere la caduta. Naviga attraverso le colonne strutturali rosse calcolando il tempo perfetto per passare in mezzo ai varchi."
          iconName="rocket"
          onStart={() => setIsPlaying(true)}
          onBack={() => navigation.goBack()}
        />

        {isPlaying && (
          <ArcadeGameWebView
            htmlContent={htmlGameContent}
            gameId="ChuteTap"
            routeParams={route.params}
            onExit={() => navigation.goBack()}
            onRestart={() => setIsPlaying(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

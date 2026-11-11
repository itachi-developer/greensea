import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
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
    <title>3D Wall Bounce Neon</title>
    <style>
        body, html { 
            margin: 0; padding: 0; 
            background: linear-gradient(135deg, #00E5FF 0%, #B026FF 100%);
            overflow: hidden; touch-action: none; font-family: sans-serif; 
        }
        #game-container { width: 100vw; height: 100vh; display: block; }
        #hud { position: absolute; top: 20px; left: 0; width: 100%; text-align: center; color: #FFF; font-size: 38px; font-weight: 900; text-shadow: 0px 4px 10px rgba(0,0,0,0.4); z-index: 10; pointer-events: none; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
</head>
<body>
    <div id="hud">0</div>
    <div id="game-container"></div>
    
    <script>
        const container = document.getElementById('game-container');
        const hud = document.getElementById('hud');
        
        let scene, camera, renderer;
        let ball;
        let obstacles = [];
        let leftWall, rightWall;
        
        const WALL_DIST = 4.5; 
        
        let gameState = 'PLAYING';
        let score = 0;
        let lastSideLeft = false; 
        
        let ballData = {
            vx: 0.055,        
            vy: 0,
            gravity: 0.003,   
            jumpForce: 0.13,  
            radius: 0.4
        };

        function init() {
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0xB026FF, 0.015); 

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
            camera.position.set(0, 0, 15); 
            camera.lookAt(0, 0, 0);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(renderer.domElement);

            const hemiLight = new THREE.HemisphereLight(0x00E5FF, 0xB026FF, 1.2);
            scene.add(hemiLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(0, 10, 15);
            scene.add(dirLight);

            const ballGeo = new THREE.IcosahedronGeometry(ballData.radius, 3);
            const ballMat = new THREE.MeshStandardMaterial({ 
                color: 0xFFFFFF, emissive: 0xDDDDDD, emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.1 
            });
            ball = new THREE.Mesh(ballGeo, ballMat);
            
            const haloGeo = new THREE.IcosahedronGeometry(ballData.radius * 1.4, 1);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.4, wireframe: true });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            ball.add(halo);
            scene.add(ball);

            const wallGeo = new THREE.PlaneGeometry(100, 200);
            const wallMat = new THREE.MeshStandardMaterial({ 
                color: 0xFFFFFF, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.15 
            });
            
            leftWall = new THREE.Mesh(wallGeo, wallMat);
            leftWall.rotation.y = Math.PI / 2;
            leftWall.position.x = -WALL_DIST - ballData.radius;
            scene.add(leftWall);

            rightWall = new THREE.Mesh(wallGeo, wallMat);
            rightWall.rotation.y = -Math.PI / 2;
            rightWall.position.x = WALL_DIST + ballData.radius;
            scene.add(rightWall);

            window.addEventListener('pointerdown', handleJump);
            window.addEventListener('resize', onWindowResize);
            
            // ASCOLTATORE MESSAGGI DA REACT NATIVE (PER IL FIX DEL RIAVVIA)
            const handleMessage = (event) => {
                try {
                    const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                    if (msg.type === 'RESTART') {
                        resetGame();
                    }
                } catch(e) {}
            };
            window.addEventListener('message', handleMessage);
            document.addEventListener('message', handleMessage);

            animate();
        }

        // FUNZIONE DI RIAVVIO PULITA
        function resetGame() {
            score = 0;
            hud.innerText = score;
            ball.position.set(0, 0, 0);
            ballData.vy = 0;
            ballData.vx = 0.055; // Resetta la velocità iniziale
            lastSideLeft = false;
            obstacles.forEach(o => scene.remove(o));
            obstacles = [];
            gameState = 'PLAYING';
        }

        function spawnObstacle() {
            const isLeft = !lastSideLeft;
            lastSideLeft = isLeft; 
            
            const xPos = isLeft ? -WALL_DIST : WALL_DIST;
            const obsMat = new THREE.MeshStandardMaterial({ color: 0xFF0055, emissive: 0x550011, roughness: 0.2, metalness: 0.5 });
            
            const shapeRand = Math.random();
            let obsGeo;
            const blockWidth = 1.2;
            const baseHeight = 1.5; 
            
            let isTriangle = false;

            if (shapeRand < 0.4) {
                obsGeo = new THREE.BoxGeometry(blockWidth, baseHeight, 1.2); 
            } else if (shapeRand < 0.7) {
                obsGeo = new THREE.BoxGeometry(blockWidth, baseHeight * 2, 1.2); 
            } else {
                obsGeo = new THREE.ConeGeometry(0.8, 1.8, 4); 
                isTriangle = true;
            }

            const obs = new THREE.Mesh(obsGeo, obsMat);
            
            if (isTriangle) {
                obs.rotation.z = isLeft ? -Math.PI / 2 : Math.PI / 2;
            }

            obs.position.set(xPos + (isLeft ? blockWidth/2 : -blockWidth/2), 12, 0); 
            scene.add(obs);
            obstacles.push(obs);
        }

        function handleJump() {
            if (gameState === 'PLAYING') {
                ballData.vy = ballData.jumpForce;
            }
        }

        function triggerGameOver() {
            gameState = 'GAMEOVER';
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(Math.floor(score).toString());
            }
        }

        function animate() {
            requestAnimationFrame(animate);

            if (gameState === 'PLAYING') {
                ballData.vy -= ballData.gravity;
                ball.position.y += ballData.vy;
                ball.position.x += ballData.vx;
                
                ball.rotation.z -= ballData.vx * 2;
                ball.rotation.x += ballData.vy;

                if (ball.position.x > WALL_DIST - 0.2) {
                    ball.position.x = WALL_DIST - 0.2;
                    ballData.vx = -ballData.vx;
                    score++;
                    hud.innerText = score;
                } else if (ball.position.x < -WALL_DIST + 0.2) {
                    ball.position.x = -WALL_DIST + 0.2;
                    ballData.vx = -Math.abs(ballData.vx);
                    ballData.vx = -ballData.vx; 
                    score++;
                    hud.innerText = score;
                }

                // FIX 1: Spazio di gioco ampliato. Ora muori solo se esci VERAMENTE dallo schermo
                if (ball.position.y < -9 || ball.position.y > 9) {
                    triggerGameOver();
                }

                let canSpawn = false;
                let currentSafeGap = Math.max(5.5, 11 - (score * 0.15));

                if (obstacles.length === 0) {
                    canSpawn = true;
                } else {
                    let lastObstacle = obstacles[obstacles.length - 1];
                    if (lastObstacle.position.y < (12 - currentSafeGap)) {
                        canSpawn = true;
                    }
                }

                if (canSpawn) {
                    spawnObstacle();
                }

                const ballBox = new THREE.Box3().setFromObject(ball);
                // FIX 2: Collisione della palla ridotta drasticamente (rimane solo il "nucleo" centrale)
                ballBox.expandByScalar(-0.25); 
                
                for (let i = obstacles.length - 1; i >= 0; i--) {
                    let obs = obstacles[i];
                    
                    let dropSpeed = 0.05 + (score * 0.001); 
                    obs.position.y -= dropSpeed;
                    
                    const obsBox = new THREE.Box3().setFromObject(obs);
                    // FIX 2: Collisione degli ostacoli piallata. Niente più morti per essere passati vicini.
                    obsBox.expandByScalar(-0.35); 
                    
                    if (ballBox.intersectsBox(obsBox)) {
                        triggerGameOver();
                        break;
                    }

                    if (obs.position.y < -12) {
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

export default function WallBounceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'WallBounce'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'WallBounce'>>();
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
        <Text style={gameStyles.headerTitle}>WALL BOUNCE 3D</Text>
        <View style={gameStyles.scoreBox}>
          <Text style={gameStyles.scoreText}>ARCADE</Text>
        </View>
      </BlurView>

      <View style={gameStyles.container}>
        <PreGameModal
          visible={!isPlaying}
          title="WALL BOUNCE"
          description="La sfera rimbalza da un muro all'altro. Tocca lo schermo per lanciarti verso l'alto e contrastare la gravità. Calibra i salti per evitare gli ostacoli laterali in movimento!"
          iconName="swap-horizontal"
          onStart={() => setIsPlaying(true)}
          onBack={() => navigation.goBack()}
        />

        {isPlaying && (
          <ArcadeGameWebView
            htmlContent={htmlGameContent}
            gameId="WallBounce"
            routeParams={route.params}
            onExit={() => navigation.goBack()}
            onRestart={() => setIsPlaying(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
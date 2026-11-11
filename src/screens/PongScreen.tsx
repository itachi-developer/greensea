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
    <title>3D Solo Bounce Neon</title>
    <style>
        body, html { 
            margin: 0; padding: 0; 
            background: linear-gradient(135deg, #00E5FF 0%, #B026FF 100%);
            overflow: hidden; touch-action: none; font-family: sans-serif; 
        }
        #game-container { width: 100vw; height: 100vh; display: block; }
        #hud { position: absolute; top: 50px; left: 0; width: 100%; text-align: center; color: rgba(255,255,255,0.7); font-size: 80px; font-weight: 900; z-index: 10; pointer-events: none; text-shadow: 0px 0px 20px rgba(0,0,0,0.3); }
        
        #game-over { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(5, 11, 20, 0.7); color: white; display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 20; backdrop-filter: blur(10px); }
        h1 { font-size: 64px; color: #FFF; margin-bottom: 10px; text-shadow: 0px 4px 20px #FF0055; margin-top: 0; }
        h2 { font-size: 24px; color: #fff; text-shadow: 0px 2px 5px rgba(0,0,0,0.2); margin-bottom: 30px; }
        
        .start-btn {
            background: #FFEA00;
            color: #050B14;
            font-size: 22px;
            font-weight: 900;
            padding: 16px 40px;
            border: none;
            border-radius: 12px;
            box-shadow: 0px 0px 20px #FFEA00;
            cursor: pointer;
            letter-spacing: 2px;
            pointer-events: auto;
        }
        .start-btn:active {
            transform: scale(0.95);
            box-shadow: 0px 0px 10px #FFEA00;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
</head>
<body>
    <div id="hud">0</div>
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
        let ball, playerPaddle;
        
        let gameState = 'PLAYING';
        let score = 0;
        
        const courtWidth = 20;
        const courtLength = 36;
        const paddleWidth = 4.5;
        
        let ballData = {
            vx: 0.15,
            vz: 0.20,
            radius: 0.6,
            baseVz: 0.20
        };

        let activeObstacle = null;
        let obstacleTimer = 0;
        const SPAWN_SCORE_THRESHOLD = 20;

        function init() {
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0xB026FF, 0.015);

            camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
            camera.position.set(0, 42, 0); 
            camera.lookAt(0, 0, 0);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(10, 20, 10);
            scene.add(dirLight);

            const courtGeo = new PlaneGeometry(courtWidth, courtLength);
            const courtMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.1 });
            const court = new THREE.Mesh(courtGeo, courtMat);
            court.rotation.x = -Math.PI / 2;
            scene.add(court);

            const borderMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3 });
            
            const sideBorderGeo = new THREE.BoxGeometry(0.5, 1, courtLength);
            const leftBorder = new THREE.Mesh(sideBorderGeo, borderMat);
            leftBorder.position.set(-courtWidth/2 - 0.25, 0.5, 0);
            scene.add(leftBorder);
            
            const rightBorder = new THREE.Mesh(sideBorderGeo, borderMat);
            rightBorder.position.set(courtWidth/2 + 0.25, 0.5, 0);
            scene.add(rightBorder);

            const topBorderGeo = new THREE.BoxGeometry(courtWidth, 1, 0.5);
            const topBorder = new THREE.Mesh(topBorderGeo, borderMat);
            topBorder.position.set(0, 0.5, -courtLength/2 - 0.25);
            scene.add(topBorder);

            const ballGeo = new THREE.IcosahedronGeometry(ballData.radius, 1);
            const ballMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.1, metalness: 0.5, emissive: 0x444444 });
            ball = new THREE.Mesh(ballGeo, ballMat);
            ball.position.set(0, 0.6, 0);
            
            const haloGeo = new THREE.IcosahedronGeometry(ballData.radius * 1.4, 1);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.4, wireframe: true });
            ball.add(new THREE.Mesh(haloGeo, haloMat));
            scene.add(ball);

            const paddleGeo = new THREE.BoxGeometry(paddleWidth, 1, 1.2);
            const playerMat = new THREE.MeshStandardMaterial({ 
                color: 0x00E5FF, 
                emissive: 0x0088AA, 
                emissiveIntensity: 0.8, 
                roughness: 0.2, 
                metalness: 0.8 
            });
            playerPaddle = new THREE.Mesh(paddleGeo, playerMat);
            
            const pWireGeo = new THREE.BoxGeometry(paddleWidth + 0.2, 1.2, 1.4);
            const pWireMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.6 });
            playerPaddle.add(new THREE.Mesh(pWireGeo, pWireMat));

            playerPaddle.position.set(0, 0.5, courtLength / 2 - 2);
            scene.add(playerPaddle);

            container.addEventListener('pointermove', (e) => {
                if (gameState !== 'PLAYING') return;
                let xNorm = (e.clientX / window.innerWidth) * 2 - 1; 
                playerPaddle.position.x = xNorm * (courtWidth / 2);
                if (playerPaddle.position.x > courtWidth/2 - paddleWidth/2) playerPaddle.position.x = courtWidth/2 - paddleWidth/2;
                if (playerPaddle.position.x < -courtWidth/2 + paddleWidth/2) playerPaddle.position.x = -courtWidth/2 + paddleWidth/2;
            });

            document.getElementById('restart-btn').addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                resetGame();
            });

            window.addEventListener('resize', onWindowResize);
            animate();
        }

        function PlaneGeometry(w, h) {
            return new THREE.PlaneGeometry(w, h);
        }

        function resetBall() {
            ball.position.set(0, 0.6, -courtLength / 4); 
            ballData.vx = (Math.random() > 0.5 ? 1 : -1) * 0.15;
            ballData.vz = ballData.baseVz; 
        }

        function triggerGameOver() {
            gameState = 'GAMEOVER';
            
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(score.toString());
            }
        }

        function resetGame() {
            score = 0;
            hud.innerText = score;
            resetBall();
            playerPaddle.position.x = 0;
            
            if (activeObstacle) {
                scene.remove(activeObstacle);
                activeObstacle = null;
            }
            obstacleTimer = 0;
            
            gameOverScreen.style.display = 'none';
            gameState = 'PLAYING';

            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('RESTART');
            }
        }

        function spawnTemporaryObstacle() {
            const obsGeo = new THREE.OctahedronGeometry(1.5, 0); 
            const obsMat = new THREE.MeshStandardMaterial({ color: 0xFF0055, emissive: 0xAA0033, emissiveIntensity: 0.6 });
            activeObstacle = new THREE.Mesh(obsGeo, obsMat);
            
            const wireGeo = new THREE.OctahedronGeometry(1.7, 0);
            const wireMat = new THREE.MeshBasicMaterial({ color: 0xFF0055, wireframe: true, transparent: true, opacity: 0.5 });
            activeObstacle.add(new THREE.Mesh(wireGeo, wireMat));
            
            const xPos = (Math.random() - 0.5) * (courtWidth - 6);
            const zPos = -(Math.random() * 12 + 4); 
            
            activeObstacle.position.set(xPos, 0.6, zPos);
            activeObstacle.userData = { lifeTime: 240 }; 
            
            scene.add(activeObstacle);
        }

        function animate() {
            requestAnimationFrame(animate);

            if (gameState === 'PLAYING') {
                ball.position.x += ballData.vx;
                ball.position.z += ballData.vz;
                
                ball.rotation.x += ballData.vz * 0.5;
                ball.rotation.z -= ballData.vx * 0.5;

                if (ball.position.x >= courtWidth/2 - ballData.radius) {
                    ball.position.x = courtWidth/2 - ballData.radius;
                    ballData.vx = -Math.abs(ballData.vx);
                } else if (ball.position.x <= -courtWidth/2 + ballData.radius) {
                    ball.position.x = -courtWidth/2 + ballData.radius;
                    ballData.vx = Math.abs(ballData.vx);
                }

                if (ball.position.z <= -courtLength/2 + ballData.radius) {
                    ball.position.z = -courtLength/2 + ballData.radius;
                    ballData.vz = Math.abs(ballData.vz);
                }

                if (score >= SPAWN_SCORE_THRESHOLD) {
                    if (!activeObstacle) {
                        obstacleTimer++;
                        if (obstacleTimer > 180) {
                            spawnTemporaryObstacle();
                            obstacleTimer = 0;
                        }
                    } else {
                        activeObstacle.userData.lifeTime--;
                        
                        activeObstacle.rotation.y += 0.04;
                        activeObstacle.rotation.x += 0.02;

                        if (activeObstacle.userData.lifeTime <= 0) {
                            scene.remove(activeObstacle);
                            activeObstacle = null;
                            obstacleTimer = 0;
                        } else {
                            const ballBox = new THREE.Box3().setFromObject(ball);
                            ballBox.expandByScalar(-0.1);
                            const obsBox = new THREE.Box3().setFromObject(activeObstacle);
                            obsBox.expandByScalar(-0.2); 

                            if (ballBox.intersectsBox(obsBox)) {
                                let dx = ball.position.x - activeObstacle.position.x;
                                let dz = ball.position.z - activeObstacle.position.z;
                                
                                if (Math.abs(dx) > Math.abs(dz)) {
                                    ballData.vx = Math.sign(dx) * Math.abs(ballData.vx);
                                } else {
                                    ballData.vz = Math.sign(dz) * Math.abs(ballData.vz);
                                }
                                
                                ball.position.x += ballData.vx * 1.5;
                                ball.position.z += ballData.vz * 1.5;
                            }
                        }
                    }
                }

                if (ballData.vz > 0 && ball.position.z >= playerPaddle.position.z - (1 + ballData.radius)) {
                    if (ball.position.x > playerPaddle.position.x - paddleWidth/2 - 0.5 && 
                        ball.position.x < playerPaddle.position.x + paddleWidth/2 + 0.5) {
                        
                        score++;
                        hud.innerText = score;

                        let currentAbsVz = Math.abs(ballData.vz);
                        let nextSpeed = currentAbsVz + 0.005; 
                        if (nextSpeed > 0.45) nextSpeed = 0.45; 
                        
                        ballData.vz = -nextSpeed; 
                        
                        let hitFactor = (ball.position.x - playerPaddle.position.x) / (paddleWidth/2);
                        ballData.vx = hitFactor * 0.35;
                        
                        ball.position.z = playerPaddle.position.z - (1 + ballData.radius);
                    }
                }

                if (ball.position.z > playerPaddle.position.z + 2) {
                    triggerGameOver();
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
        resetBall();
    </script>
</body>
</html>
`;

export default function PongScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Pong3D'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Pong3D'>>();
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
        <Text style={gameStyles.headerTitle}>SOLO BOUNCE 3D</Text>
        <View style={gameStyles.scoreBox}>
          <Text style={gameStyles.scoreText}>ARCADE</Text>
        </View>
      </BlurView>

      <View style={gameStyles.container}>
        <PreGameModal
          visible={!isPlaying}
          title="MISSION BRIEFING // SOLO BOUNCE"
          description="Trascina il dito a DESTRA e SINISTRA sullo schermo per muovere il tuo deflettore.\n\nFai rimbalzare la sfera contro il muro superiore. Ogni colpo andato a segno aumenta il punteggio e la velocità della palla! Non farla cadere giù. Attenzione: dopo i 20 Punti inizieranno a comparire ostacoli in aria."
          iconName="tennisball"
          onStart={() => setIsPlaying(true)}
          onBack={() => navigation.goBack()}
        />

        {isPlaying && (
          <ArcadeGameWebView
            htmlContent={htmlGameContent}
            gameId="Pong3D"
            routeParams={route.params}
            onExit={() => navigation.goBack()}
            onRestart={() => setIsPlaying(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

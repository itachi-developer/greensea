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
  <style>
    body, html { 
      margin: 0; padding: 0; 
      background: linear-gradient(135deg, #050011 0%, #150030 50%, #000511 100%);
      overflow: hidden; touch-action: none; font-family: monospace, sans-serif; 
      user-select: none; -webkit-user-select: none;
    }
    #game-container { width: 100vw; height: 100vh; display: block; }
    
    #ui-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; display: flex; flex-direction: column; align-items: center; }
    
    #stats-bar { margin-top: 20px; background: rgba(5, 11, 20, 0.85); border: 1px solid #00E5FF; padding: 10px 20px; border-radius: 8px; color: #FFF; font-weight: bold; font-size: 14px; letter-spacing: 2px; text-shadow: 0 0 10px #00E5FF; display: flex; gap: 20px; box-shadow: 0 0 15px rgba(0,229,255,0.4); backdrop-filter: blur(5px); }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
</head>
<body>
  <div id="ui-layer">
    <div id="stats-bar">
      <span id="moves-display">MOSSE: 0</span>
      <span id="time-display">TEMPO: 00:00</span>
    </div>
  </div>
  <div id="game-container"></div>
  
  <script>
    const container = document.getElementById('game-container');
    const movesDisplay = document.getElementById('moves-display');
    const timeDisplay = document.getElementById('time-display');
    
    let scene, camera, renderer, raycaster;
    let gridGroup;
    let tiles = {}; 
    
    let board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    let emptyIndex = 15;
    
    let moves = 0;
    let seconds = 0;
    let timerInterval = null;
    let gameState = 'PLAYING';
    
    let checkWinPending = false;

    const TILE_SIZE = 2.0; 
    const SPACING = 0.2;
    const TOTAL_SIZE = TILE_SIZE + SPACING;
    const OFFSET = (TOTAL_SIZE * 3) / 2;
    const GRID_WIDTH = TOTAL_SIZE * 4;

    function init() {
      scene = new THREE.Scene();
      
      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
      
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(renderer.domElement);

      raycaster = new THREE.Raycaster();

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);
      
      const cyanLight = new THREE.DirectionalLight(0x00E5FF, 1.2);
      cyanLight.position.set(10, 10, 10);
      scene.add(cyanLight);

      const magentaLight = new THREE.DirectionalLight(0xFF0055, 1.0);
      magentaLight.position.set(-10, -10, 5);
      scene.add(magentaLight);

      gridGroup = new THREE.Group();
      scene.add(gridGroup);

      const baseGeo = new THREE.PlaneGeometry(GRID_WIDTH + 0.5, GRID_WIDTH + 0.5);
      const baseMat = new THREE.MeshBasicMaterial({ color: 0xFF0055, wireframe: true, transparent: true, opacity: 0.15 });
      const gridBase = new THREE.Mesh(baseGeo, baseMat);
      gridBase.position.z = -0.5;
      gridGroup.add(gridBase);

      createBoard();
      shuffleBoard();
      
      setupGestureControls();
      window.addEventListener('resize', onWindowResize);
      onWindowResize(); 
      
      document.addEventListener('message', handleRNMessage);
      window.addEventListener('message', handleRNMessage);

      startTimer();
      animate();
    }

    function createBoard() {
      const tileGeo = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, 0.4);
      const edgeGeo = new THREE.EdgesGeometry(tileGeo);

      for (let i = 1; i <= 15; i++) {
        let hue = (i / 15) * 360;
        let colorStr = 'hsl(' + hue + ', 100%, 60%)';
        let edgeColor = new THREE.Color(colorStr);

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);
        
        ctx.fillStyle = colorStr; 
        ctx.font = '900 140px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i, 128, 140);
        
        const texture = new THREE.CanvasTexture(canvas);
        
        const mat = new THREE.MeshStandardMaterial({ 
          color: 0x050515, roughness: 0.1, metalness: 0.8, emissive: 0x110022, 
          transparent: true, opacity: 0.85
        });
        
        const mesh = new THREE.Mesh(tileGeo, mat);
        
        const numGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const numMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
        const numMesh = new THREE.Mesh(numGeo, numMat);
        numMesh.position.z = 0.21; 
        mesh.add(numMesh);

        const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: edgeColor, linewidth: 2 }));
        mesh.add(edges);

        mesh.userData = { id: i, targetX: 0, targetY: 0, edges: edges, numMesh: numMesh, originalColor: edgeColor };
        
        gridGroup.add(mesh);
        tiles[i] = mesh;
      }
      syncVisualsToBoard(false);
    }

    function getPositionForIndex(index) {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const x = col * TOTAL_SIZE - OFFSET;
      const y = -(row * TOTAL_SIZE) + OFFSET;
      return { x, y };
    }

    function syncVisualsToBoard(animateTransition = false) {
      for (let i = 0; i < 16; i++) {
        const val = board[i];
        if (val !== 0) {
          const mesh = tiles[val];
          const pos = getPositionForIndex(i);
          
          mesh.userData.targetX = pos.x;
          mesh.userData.targetY = pos.y;
          
          if (!animateTransition) {
            mesh.position.x = pos.x;
            mesh.position.y = pos.y;
          }
        }
      }
    }

    function setupGestureControls() {
        let touchStartX = 0, touchStartY = 0;

        document.addEventListener('touchstart', e => {
            if(gameState !== 'PLAYING') return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: false });

        document.addEventListener('touchmove', e => {
            if(gameState !== 'PLAYING') return;
            e.preventDefault(); 
        }, { passive: false });

        document.addEventListener('touchend', e => {
            if(gameState !== 'PLAYING' || !touchStartX || !touchStartY) return;
            
            let endX = e.changedTouches[0].clientX;
            let endY = e.changedTouches[0].clientY;

            let dx = endX - touchStartX;
            let dy = endY - touchStartY;

            if (Math.abs(dx) > 25 || Math.abs(dy) > 25) {
                let direction = '';
                if (Math.abs(dx) > Math.abs(dy)) {
                    direction = dx > 0 ? 'RIGHT' : 'LEFT';
                } else {
                    direction = dy > 0 ? 'DOWN' : 'UP';
                }
                executeSwipeMove(direction);
            } 
            else {
                executeTapMove(endX, endY);
            }
            
            touchStartX = 0; touchStartY = 0;
        });
    }

    function executeTapMove(clientX, clientY) {
        let mouse = new THREE.Vector2();
        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        const validTiles = Object.values(tiles);
        const intersects = raycaster.intersectObjects(validTiles, false);
        
        if (intersects.length > 0) {
            const clickedId = intersects[0].object.userData.id;
            const clickedIndex = board.indexOf(clickedId);
            const validMoves = getValidMoves(emptyIndex);
            
            if (validMoves.includes(clickedIndex)) {
                executeMoveByIndex(clickedIndex);
            }
        }
    }

    function executeSwipeMove(direction) {
        let emptyRow = Math.floor(emptyIndex / 4);
        let emptyCol = emptyIndex % 4;
        let targetIndex = -1;

        if (direction === 'RIGHT' && emptyCol > 0) targetIndex = emptyIndex - 1; 
        if (direction === 'LEFT' && emptyCol < 3) targetIndex = emptyIndex + 1;  
        if (direction === 'DOWN' && emptyRow > 0) targetIndex = emptyIndex - 4;  
        if (direction === 'UP' && emptyRow < 3) targetIndex = emptyIndex + 4;    

        if (targetIndex !== -1) {
            executeMoveByIndex(targetIndex);
        }
    }

    function executeMoveByIndex(targetIndex) {
        board[emptyIndex] = board[targetIndex];
        board[targetIndex] = 0;
        emptyIndex = targetIndex;
        
        moves++;
        updateUI();
        syncVisualsToBoard(true);
        
        if (isSolved()) {
            checkWinPending = true;
        }
    }

    function getValidMoves(idx) {
      let row = Math.floor(idx / 4);
      let col = idx % 4;
      let m = [];
      if (row > 0) m.push(idx - 4);
      if (row < 3) m.push(idx + 4);
      if (col > 0) m.push(idx - 1);
      if (col < 3) m.push(idx + 1);
      return m;
    }

    function shuffleBoard() {
      for (let i = 0; i < 350; i++) {
        let valid = getValidMoves(emptyIndex);
        let target = valid[Math.floor(Math.random() * valid.length)];
        board[emptyIndex] = board[target];
        board[target] = 0;
        emptyIndex = target;
      }
      if (isSolved()) shuffleBoard();
      syncVisualsToBoard(false);
    }

    function isSolved() {
      for (let i = 0; i < 15; i++) {
        if (board[i] !== i + 1) return false;
      }
      return board[15] === 0;
    }

    function startTimer() {
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (gameState === 'PLAYING') {
          seconds++;
          updateUI();
        }
      }, 1000);
    }

    function formatTime(s) {
      let mins = Math.floor(s / 60);
      let secs = s % 60;
      return (mins < 10 ? '0' + mins : mins) + ':' + (secs < 10 ? '0' + secs : secs);
    }

    function updateUI() {
      movesDisplay.innerText = 'MOSSE: ' + moves;
      timeDisplay.innerText = 'TEMPO: ' + formatTime(seconds);
    }

    function triggerWin() {
      gameState = 'WON';
      if (timerInterval) clearInterval(timerInterval);
      
      Object.values(tiles).forEach(m => {
         m.material.emissive.setHex(0x004411);
         m.userData.edges.material.color.setHex(0x39FF14);
      });
      
      let score = Math.max(100, 3000 - (moves * 12) - (seconds * 8));
      
      if (window.ReactNativeWebView) {
          setTimeout(() => {
              window.ReactNativeWebView.postMessage(score.toString());
          }, 600); 
      }
    }

    function handleRNMessage(event) {
        try {
            if(event.data === 'RESTART') {
                board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
                emptyIndex = 15;
                shuffleBoard();
                moves = 0;
                seconds = 0;
                gameState = 'PLAYING';
                checkWinPending = false;
                updateUI();
                startTimer();
                
                Object.values(tiles).forEach(m => {
                   m.material.emissive.setHex(0x110022);
                   m.userData.edges.material.color = m.userData.originalColor;
                });
            }
        } catch(e) {}
    }

    function animate() {
      requestAnimationFrame(animate);

      gridGroup.rotation.y = Math.sin(Date.now() * 0.0008) * 0.05;
      gridGroup.rotation.x = Math.cos(Date.now() * 0.0008) * 0.05;

      let anyMoving = false;
      let time = Date.now() * 0.005;

      for (let i = 1; i <= 15; i++) {
        let mesh = tiles[i];
        
        let dx = mesh.userData.targetX - mesh.position.x;
        let dy = mesh.userData.targetY - mesh.position.y;

        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
            mesh.position.x += dx * 0.35;
            mesh.position.y += dy * 0.35;
            anyMoving = true;
        } else {
            mesh.position.x = mesh.userData.targetX;
            mesh.position.y = mesh.userData.targetY;
        }

        mesh.position.z = Math.sin(time + mesh.userData.id) * 0.15;
      }

      if (checkWinPending && !anyMoving) {
          checkWinPending = false;
          triggerWin();
      }

      renderer.render(scene, camera);
    }

    function onWindowResize() {
      const aspect = window.innerWidth / window.innerHeight;
      camera.aspect = aspect;
      
      const fovRad = (camera.fov / 2) * (Math.PI / 180);
      const neededZ = (GRID_WIDTH / 2 + 1) / (Math.tan(fovRad) * aspect);
      
      camera.position.z = Math.max(10, neededZ);
      
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    init();
  </script>
</body>
</html>
`;

export default function Dominio15Screen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Dominio15'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Dominio15'>>();
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

      <BlurView intensity={90} tint="dark" style={gameStyles.header} pointerEvents="box-none">
        <TouchableOpacity style={gameStyles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={gameStyles.headerTitle}>DOMINIO 15 3D</Text>
        <View style={gameStyles.scoreBox}>
          <Text style={gameStyles.scoreText}>ARCADE</Text>
        </View>
      </BlurView>

      <View style={gameStyles.container}>
        <PreGameModal
          visible={!isPlaying}
          title="DOMINIO 15 3D"
          description="La griglia neurale 3D è frammentata.\n\nFai SWIPE sullo schermo in qualsiasi direzione oppure fai TAP direttamente su una pedina per farla scorrere nello spazio vuoto.\n\nRiordina la sequenza da 1 a 15, lasciando l'ultimo slot in basso a destra libero per ripristinare il sistema."
          iconName="grid"
          onStart={() => setIsPlaying(true)}
          onBack={() => navigation.goBack()}
        />

        {isPlaying && (
          <ArcadeGameWebView
            htmlContent={htmlGameContent}
            gameId="Dominio15"
            routeParams={route.params}
            onExit={() => navigation.goBack()}
            onRestart={() => setIsPlaying(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

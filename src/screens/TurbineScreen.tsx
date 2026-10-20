import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
  Easing,
  Modal,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(width - 40, 340);
const RADIUS = WHEEL_SIZE / 2;

interface Sector {
  id: number;
  label: string;
  type: 'multiplier' | 'ticket' | 'minigame' | 'energy';
  color: string;
  badge: string;
  rewardText: string;
}

const SECTORS: Sector[] = [
  { id: 0, label: 'x2', type: 'multiplier', color: '#00F0FF', badge: 'MOLTIPLICATORE', rewardText: 'Moltiplicatore x2 applicato!' },
  { id: 1, label: 'TICKET', type: 'ticket', color: '#FF0055', badge: 'ARENA PASS', rewardText: '1x Ticket Ingresso Arena!' },
  { id: 2, label: 'BONUS', type: 'minigame', color: '#9D00FF', badge: 'MINIGIOCO', rewardText: 'Accesso al Minigioco Segreto!' },
  { id: 3, label: 'x5', type: 'multiplier', color: '#FFD700', badge: 'MEGA MOLTIPLICATORE', rewardText: 'Moltiplicatore x5 attivo!' },
  { id: 4, label: '50 ⚡', type: 'energy', color: '#39FF14', badge: 'RICARICA RAPIDA', rewardText: '50 Unità di Energia caricate!' },
  { id: 5, label: 'x10', type: 'multiplier', color: '#FF3366', badge: 'JACKPOT MULTIPLIER', rewardText: 'Super Moltiplicatore x10!' },
  { id: 6, label: 'GOLD', type: 'ticket', color: '#FF9900', badge: 'TICKET ORO', rewardText: 'Ticket Dominio d\'Oro sbloccato!' },
  { id: 7, label: '100 ⚡', type: 'energy', color: '#00E5FF', badge: 'SUPERCHARGE', rewardText: '100 Unità di Energia ottenute!' },
];

const SECTOR_ANGLE = 360 / SECTORS.length;

export default function TurbineScreen() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [winningSector, setWinningSector] = useState<Sector | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const spinValue = useRef(new Animated.Value(0)).current;
  const currentAngle = useRef(0);
  const loopAnimation = useRef<Animated.CompositeAnimation | null>(null);

  // Monitora costantemente il valore dell'angolo
  React.useEffect(() => {
    const listenerId = spinValue.addListener(({ value }) => {
      currentAngle.current = value;
    });
    return () => {
      spinValue.removeListener(listenerId);
    };
  }, [spinValue]);

  // Avvio rotazione infinita
  const startSpinning = () => {
    if (isSpinning || isStopping) return;

    setIsSpinning(true);
    setWinningSector(null);

    // Resetta o continua dall'angolo corrente modulato
    const startingValue = currentAngle.current % 360;
    spinValue.setValue(startingValue);

    loopAnimation.current = Animated.loop(
      Animated.timing(spinValue, {
        toValue: startingValue + 360,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loopAnimation.current.start();
  };

  // Arresto con decelerazione controllata
  const stopSpinning = () => {
    if (!isSpinning || isStopping) return;

    setIsStopping(true);

    if (loopAnimation.current) {
      loopAnimation.current.stop();
    }

    const startDecelAngle = currentAngle.current;
    // Aggiungi tra 3 e 5 giri completi + un offset casuale
    const extraRounds = 360 * (3 + Math.floor(Math.random() * 3));
    const randomOffset = Math.floor(Math.random() * 360);
    const targetAngle = startDecelAngle + extraRounds + randomOffset;

    Animated.timing(spinValue, {
      toValue: targetAngle,
      duration: 3800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsSpinning(false);
      setIsStopping(false);

      // Calcolo dello spicchio vincente:
      // Il puntatore è posizionato a ore 12 (in alto = angolo 0)
      const normalizedAngle = (targetAngle % 360 + 360) % 360;
      // Poiché la ruota gira in senso orario, il settore sotto la freccia a ore 12
      // corrisponde a (360 - normalizedAngle) % 360
      const pointerRelativeAngle = (360 - normalizedAngle) % 360;
      const winningIndex = Math.floor(pointerRelativeAngle / SECTOR_ANGLE) % SECTORS.length;

      const result = SECTORS[winningIndex];
      setWinningSector(result);
      setModalVisible(true);
    });
  };

  const spinInterpolation = spinValue.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0D17" />
      <View style={styles.container}>
        {/* Header superiore */}
        <View style={styles.header}>
          <Text style={styles.headerTag}>CENTRIFUGA DI PARTICELLE</Text>
          <Text style={styles.title}>La Turbina 🌀</Text>
          <Text style={styles.subtitle}>
            Innesca la rotazione a flusso continuo e interrompila per canalizzare la carica.
          </Text>
        </View>

        {/* Contenitore della Ruota */}
        <View style={styles.wheelWrapper}>
          {/* Puntatore / Flessore a ore 12 */}
          <View style={styles.pointerOuter}>
            <View style={styles.pointerTriangle} />
            <View style={styles.pointerCore} />
          </View>

          {/* Disco rotante */}
          <Animated.View
            style={[
              styles.wheel,
              { transform: [{ rotate: spinInterpolation }] },
            ]}
          >
            {SECTORS.map((sector, index) => {
              const sectorAngle = index * SECTOR_ANGLE;
              return (
                <View
                  key={sector.id}
                  style={[
                    styles.sectorSpoke,
                    {
                      transform: [
                        { rotate: `${sectorAngle}deg` },
                        { translateY: -RADIUS * 0.58 },
                      ],
                    },
                  ]}
                >
                  <View style={[styles.spokeBadge, { borderColor: sector.color }]}>
                    <Text style={[styles.spokeLabel, { color: sector.color }]}>
                      {sector.label}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Nucleo centrale della ruota */}
            <View style={styles.wheelCenterCore}>
              <View style={styles.innerCorePulse} />
              <Text style={styles.coreIcon}>⚡</Text>
            </View>
          </Animated.View>
        </View>

        {/* Indicatori di stato */}
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            {isStopping
              ? 'DECELERAZIONE IN CORSO...'
              : isSpinning
              ? 'TURBINA A REGIME MASSIMO // PREMI STOP'
              : 'PRONTO ALL\'AVVIO // PREMI GIRA'}
          </Text>
        </View>

        {/* Controlli Gira / Stop */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.spinButton,
              (isSpinning || isStopping) && styles.buttonDisabled,
            ]}
            onPress={startSpinning}
            disabled={isSpinning || isStopping}
            activeOpacity={0.8}
          >
            <Text style={styles.spinButtonText}>GIRA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.stopButton,
              (!isSpinning || isStopping) && styles.buttonDisabled,
            ]}
            onPress={stopSpinning}
            disabled={!isSpinning || isStopping}
            activeOpacity={0.8}
          >
            <Text style={styles.stopButtonText}>STOP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal Vincita Celebrativo */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              winningSector && { borderColor: winningSector.color },
            ]}
          >
            <Text
              style={[
                styles.modalBadge,
                winningSector && { color: winningSector.color },
              ]}
            >
              {winningSector?.badge}
            </Text>

            <Text style={styles.modalWinningReward}>
              {winningSector?.label}
            </Text>

            <Text style={styles.modalDesc}>
              {winningSector?.rewardText}
            </Text>

            <TouchableOpacity
              style={[
                styles.claimButton,
                winningSector && { backgroundColor: winningSector.color },
              ]}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.claimButtonText}>RISCUOTI CARICA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0D17',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
  },
  headerTag: {
    color: '#00F0FF',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#8A93B0',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  wheelWrapper: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  pointerOuter: {
    position: 'absolute',
    top: -16,
    zIndex: 20,
    alignItems: 'center',
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 26,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 10,
  },
  pointerCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 4,
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: RADIUS,
    backgroundColor: '#111526',
    borderWidth: 6,
    borderColor: '#1E2640',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    elevation: 8,
  },
  sectorSpoke: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spokeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(11, 13, 23, 0.85)',
    borderWidth: 1.5,
  },
  spokeLabel: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  wheelCenterCore: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0B0D17',
    borderWidth: 3,
    borderColor: '#00F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 8,
  },
  innerCorePulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
  },
  coreIcon: {
    fontSize: 24,
  },
  statusBox: {
    backgroundColor: '#121624',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F273E',
  },
  statusText: {
    color: '#8A93B0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 14,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinButton: {
    backgroundColor: '#00F0FF',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
  },
  spinButtonText: {
    color: '#0B0D17',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  stopButton: {
    backgroundColor: '#FF0055',
    shadowColor: '#FF0055',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  buttonDisabled: {
    backgroundColor: '#1C2237',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#121624',
    borderRadius: 22,
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 20,
    elevation: 10,
  },
  modalBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  modalWinningReward: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 4,
    letterSpacing: 1,
  },
  modalDesc: {
    fontSize: 15,
    color: '#8A93B0',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  claimButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  claimButtonText: {
    color: '#0B0D17',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface GameOverModalProps {
  visible: boolean;
  score: number;
  finalScore?: number;
  isTrainingMode?: boolean;
  multiplier?: number;
  statusMessage?: string;
  onRestart: () => void;
  onExit?: () => void;
}

export default function GameOverModal({
  visible,
  score,
  finalScore,
  isTrainingMode = false,
  multiplier = 0,
  statusMessage,
  onRestart,
  onExit,
}: GameOverModalProps) {
  if (!visible) return null;

  const displayScore = finalScore !== undefined ? finalScore : score;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={95} tint="dark" style={styles.gameOverOverlayFull}>
        <Text style={styles.gameOverTitle}>CRASH DI SISTEMA</Text>
        
        <Text style={styles.gameOverScore}>
          Punteggio finale: {displayScore}{' '}
          {multiplier > 0 && !isTrainingMode && (
            <Text style={{ textDecorationLine: 'line-through', color: '#8892B0', fontSize: 16 }}>
              ({score})
            </Text>
          )}
        </Text>

        {statusMessage ? (
          <View style={[
            styles.statusBox,
            isTrainingMode && styles.statusBoxTraining,
            statusMessage.includes('SCADENTE') && styles.statusBoxWarning,
            statusMessage.includes('ESAURITI') && styles.statusBoxDanger
          ]}>
            <Ionicons 
              name={
                isTrainingMode ? "school-outline" : 
                statusMessage.includes('SCADENTE') ? "alert-circle-outline" :
                statusMessage.includes('ESAURITI') ? "lock-closed-outline" : "checkmark-circle-outline"
              } 
              size={18} 
              color={
                isTrainingMode ? "#FFD700" :
                statusMessage.includes('SCADENTE') ? "#FF8800" :
                statusMessage.includes('ESAURITI') ? "#FF0055" : "#00E5FF"
              } 
              style={{ marginRight: 6 }}
            />
            <Text style={[
              styles.statusText,
              isTrainingMode && { color: '#FFD700' },
              statusMessage.includes('SCADENTE') && { color: '#FF8800' },
              statusMessage.includes('ESAURITI') && { color: '#FF0055' }
            ]}>
              {statusMessage}
            </Text>
          </View>
        ) : null}

        {multiplier > 0 && !isTrainingMode && (
          <Text style={styles.bonusText}>
            +{multiplier}% BONUS TURBINA APPLICATO!
          </Text>
        )}

        <View style={styles.goBtnRow}>
          <TouchableOpacity 
            style={styles.goRestartBtn} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onRestart();
            }}
          >
            <Ionicons name="refresh" size={20} color="#050B14" style={{ marginRight: 8 }} />
            <Text style={styles.goRestartBtnText}>RIAVVIA</Text>
          </TouchableOpacity>

          {onExit && (
            <TouchableOpacity 
              style={styles.goExitBtn} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onExit();
              }}
            >
              <Ionicons name="exit-outline" size={20} color="#FF0055" style={{ marginRight: 8 }} />
              <Text style={styles.goExitBtnText}>ESCI</Text>
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gameOverOverlayFull: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(5, 11, 20, 0.95)',
    zIndex: 100,
  },
  gameOverTitle: {
    color: '#FF0055',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 16,
    textShadowColor: '#FF0055',
    textShadowRadius: 15,
    textAlign: 'center',
  },
  gameOverScore: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00E5FF',
    marginBottom: 20,
  },
  statusBoxTraining: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: '#FFD700',
  },
  statusBoxWarning: {
    backgroundColor: 'rgba(255, 136, 0, 0.1)',
    borderColor: '#FF8800',
  },
  statusBoxDanger: {
    backgroundColor: 'rgba(255, 0, 85, 0.1)',
    borderColor: '#FF0055',
  },
  statusText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bonusText: {
    color: '#39FF14',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: 1,
    textShadowColor: '#39FF14',
    textShadowRadius: 10,
    textAlign: 'center',
  },
  goBtnRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    maxWidth: 320,
  },
  goRestartBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    backgroundColor: '#00E5FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowRadius: 15,
    shadowOpacity: 0.4,
  },
  goRestartBtnText: {
    color: '#050B14',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  goExitBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    backgroundColor: 'rgba(255, 0, 85, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF0055',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goExitBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

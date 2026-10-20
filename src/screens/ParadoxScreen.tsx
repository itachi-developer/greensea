import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface EvaluationResult {
  multiplier: number;
  accuracyPercent: number;
  diff: number;
}

export default function ParadoxScreen() {
  // Dati della sfida corrente (fittizi per il gameplay)
  const challenge = {
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    actualYear: 1969,
    yearTolerance: 8,
    actualFermiCount: 142,
    fermiTolerance: 30,
    fermiQuestion: 'Problema di Fermi: Quanti spettatori hanno un cappello?',
    baseEnergy: 50,
  };

  const [yearGuess, setYearGuess] = useState('');
  const [fermiGuess, setFermiGuess] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [scoreData, setScoreData] = useState<{
    yearScore: EvaluationResult;
    fermiScore: EvaluationResult;
    totalMultiplier: number;
    energyEarned: number;
  } | null>(null);

  /**
   * Calcola il punteggio, moltiplicatore e precisione
   */
  const calculateScore = (
    guess: number,
    actual: number,
    tolerance: number
  ): EvaluationResult => {
    const diff = Math.abs(guess - actual);

    if (diff === 0) {
      return { multiplier: 3.0, accuracyPercent: 100, diff: 0 };
    }

    if (diff <= tolerance * 0.3) {
      const accuracy = Math.round(100 - (diff / tolerance) * 30);
      return { multiplier: 2.0, accuracyPercent: accuracy, diff };
    }

    if (diff <= tolerance) {
      const accuracy = Math.round(100 - (diff / tolerance) * 50);
      return { multiplier: 1.5, accuracyPercent: accuracy, diff };
    }

    if (diff <= tolerance * 1.8) {
      const accuracy = Math.max(10, Math.round(100 - (diff / (tolerance * 1.8)) * 80));
      return { multiplier: 0.5, accuracyPercent: accuracy, diff };
    }

    return { multiplier: 0, accuracyPercent: 0, diff };
  };

  const handleConfirmEstimate = () => {
    const parsedYear = parseInt(yearGuess, 10);
    const parsedFermi = parseInt(fermiGuess, 10);

    if (isNaN(parsedYear) || isNaN(parsedFermi)) {
      Alert.alert(
        'Input non valido',
        'Inserisci valori numerici validi sia per l\'anno che per la stima deduttiva.'
      );
      return;
    }

    const yearResult = calculateScore(parsedYear, challenge.actualYear, challenge.yearTolerance);
    const fermiResult = calculateScore(parsedFermi, challenge.actualFermiCount, challenge.fermiTolerance);

    const combinedMultiplier = Number(
      ((yearResult.multiplier + fermiResult.multiplier) / 2).toFixed(2)
    );
    const energyEarned = Math.round(challenge.baseEnergy * combinedMultiplier);

    setScoreData({
      yearScore: yearResult,
      fermiScore: fermiResult,
      totalMultiplier: combinedMultiplier,
      energyEarned,
    });
    setModalVisible(true);
  };

  const handleGoToTurbine = () => {
    setModalVisible(false);
    Alert.alert(
      'La Turbina',
      `Energia di ${scoreData?.energyEarned ?? 0} ⚡ convogliata con successo al nucleo della Turbina!`
    );
  };

  const resetGame = () => {
    setYearGuess('');
    setFermiGuess('');
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0D17" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header informativo */}
          <View style={styles.header}>
            <Text style={styles.headerTag}>ANOMALIA SPAZIO-TEMPORALE</Text>
            <Text style={styles.headerTitle}>Il Paradosso</Text>
            <Text style={styles.headerSubtitle}>
              Analizza il reperto fotografico e calcola la discrepanza temporale.
            </Text>
          </View>

          {/* Immagine con cornice cyberpunk */}
          <View style={styles.imageCard}>
            <Image
              source={{ uri: challenge.imageUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
            <View style={styles.imageOverlayBadge}>
              <Text style={styles.imageBadgeText}>ARCHIVIO #084-ALPHA</Text>
            </View>
          </View>

          {/* Input 1: Anno */}
          <View style={styles.inputCard}>
            <View style={styles.labelRow}>
              <Text style={styles.inputIndex}>01</Text>
              <Text style={styles.inputLabel}>In che anno è stata scattata?</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Es. 1974"
              placeholderTextColor="#6C7293"
              keyboardType="number-pad"
              maxLength={4}
              value={yearGuess}
              onChangeText={setYearGuess}
            />
          </View>

          {/* Input 2: Problema di Fermi */}
          <View style={styles.inputCard}>
            <View style={styles.labelRow}>
              <Text style={styles.inputIndex}>02</Text>
              <Text style={styles.inputLabel}>{challenge.fermiQuestion}</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Inserisci stima numerica (es. 120)"
              placeholderTextColor="#6C7293"
              keyboardType="number-pad"
              maxLength={6}
              value={fermiGuess}
              onChangeText={setFermiGuess}
            />
          </View>

          {/* Bottone di Conferma */}
          <TouchableOpacity
            style={styles.confirmButton}
            activeOpacity={0.85}
            onPress={handleConfirmEstimate}
          >
            <Text style={styles.confirmButtonText}>CONFERMA STIMA ⚡</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Risultati */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalBadge}>ESITO ANALISI TEMPORALE</Text>
            <Text style={styles.modalEnergyTitle}>
              +{scoreData?.energyEarned} ⚡
            </Text>
            <Text style={styles.modalMultiplierText}>
              Moltiplicatore Totale: x{scoreData?.totalMultiplier}
            </Text>

            <View style={styles.modalStatsBox}>
              <View style={styles.statRow}>
                <Text style={styles.statName}>Anno Effettivo:</Text>
                <Text style={styles.statValue}>
                  {challenge.actualYear} (Stima: {yearGuess || 'N/A'})
                </Text>
              </View>
              <Text style={styles.statAccuracy}>
                Precisione Anno: {scoreData?.yearScore.accuracyPercent}% (x{scoreData?.yearScore.multiplier})
              </Text>

              <View style={[styles.statRow, { marginTop: 12 }]}>
                <Text style={styles.statName}>Stima Fermi Effettiva:</Text>
                <Text style={styles.statValue}>
                  ~{challenge.actualFermiCount} (Stima: {fermiGuess || 'N/A'})
                </Text>
              </View>
              <Text style={styles.statAccuracy}>
                Precisione Fermi: {scoreData?.fermiScore.accuracyPercent}% (x{scoreData?.fermiScore.multiplier})
              </Text>
            </View>

            <TouchableOpacity
              style={styles.turbineButton}
              activeOpacity={0.85}
              onPress={handleGoToTurbine}
            >
              <Text style={styles.turbineButtonText}>VAI ALLA TURBINA 🌀</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retryButton}
              activeOpacity={0.85}
              onPress={resetGame}
            >
              <Text style={styles.retryButtonText}>Riprova Stima</Text>
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
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  headerTag: {
    color: '#00F0FF',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#8A93B0',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  imageCard: {
    backgroundColor: '#121624',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#1E2538',
    marginBottom: 20,
    position: 'relative',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  photo: {
    width: '100%',
    height: 220,
    backgroundColor: '#161B2E',
  },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(11, 13, 23, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00F0FF',
  },
  imageBadgeText: {
    color: '#00F0FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  inputCard: {
    backgroundColor: '#121624',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2538',
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputIndex: {
    color: '#00F0FF',
    fontWeight: '800',
    fontSize: 13,
    marginRight: 8,
    backgroundColor: '#00F0FF1A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inputLabel: {
    color: '#E0E6ED',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  textInput: {
    backgroundColor: '#181E30',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#2B3552',
  },
  confirmButton: {
    backgroundColor: '#00F0FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#00F0FF',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 6,
  },
  confirmButtonText: {
    color: '#0B0D17',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#121624',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
  },
  modalBadge: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  modalEnergyTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    marginBottom: 4,
  },
  modalMultiplierText: {
    color: '#00F0FF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalStatsBox: {
    width: '100%',
    backgroundColor: '#181E30',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#232C45',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statName: {
    color: '#8A93B0',
    fontSize: 13,
    fontWeight: '600',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  statAccuracy: {
    color: '#39FF14',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  turbineButton: {
    width: '100%',
    backgroundColor: '#39FF14',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#39FF14',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  turbineButtonText: {
    color: '#0B0D17',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  retryButton: {
    width: '100%',
    backgroundColor: '#1E2538',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#8A93B0',
    fontSize: 14,
    fontWeight: '700',
  },
});

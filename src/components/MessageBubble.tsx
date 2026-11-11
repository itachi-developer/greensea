import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';

export type MessageItem = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
  status?: string;
  is_read?: boolean;
  is_view_once?: boolean;
  has_been_viewed?: boolean;
  profiles?: { username?: string; avatar_url?: string };
};

interface MessageBubbleProps {
  item: MessageItem;
  currentUserId: string | null;
  senderName?: string;
  onOpenViewOnce?: (item: MessageItem) => void;
}

export default function MessageBubble({ item, currentUserId, senderName, onOpenViewOnce }: MessageBubbleProps) {
  const isMe = item.sender_id === currentUserId;
  const formattedTime = item.created_at
    ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const senderAvatarUrl = item.profiles?.avatar_url;
  const senderInitial = (senderName || item.profiles?.username || 'U').charAt(0).toUpperCase();

  const renderContent = () => {
    if (item.media_type === 'gif' && item.media_url) {
      return <ExpoImage source={{ uri: item.media_url }} style={styles.mediaImage} contentFit="cover" />;
    }

    if (item.media_type === 'lottie') {
      return (
        <View style={styles.lottieContainer}>
          <LottieView
            source={{ uri: item.media_url || 'https://assets2.lottiefiles.com/packages/lf20_j1adxt.json' }}
            autoPlay
            loop
            style={styles.lottieAnimation}
          />
        </View>
      );
    }

    if (item.is_view_once) {
      if (item.has_been_viewed) {
        return (
          <View style={styles.viewOnceBox}>
            <Ionicons name="eye-off-outline" size={16} color={isMe ? '#0A192F' : '#8892B0'} style={{ marginRight: 6 }} />
            <Text style={[styles.viewOnceText, isMe && { color: '#0A192F' }]}>Foto 1-Time già aperta</Text>
          </View>
        );
      }
      return (
        <TouchableOpacity 
          style={styles.viewOnceButton} 
          onPress={() => onOpenViewOnce && onOpenViewOnce(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={18} color="#FFD700" style={{ marginRight: 8 }} />
          <Text style={styles.viewOnceButtonText}>APRI FOTO 1-TIME</Text>
        </TouchableOpacity>
      );
    }

    return <Text style={isMe ? styles.textMe : styles.textOther}>{item.content}</Text>;
  };

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
      {!isMe && (
        senderAvatarUrl ? (
          <Image source={{ uri: senderAvatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{senderInitial}</Text>
          </View>
        )
      )}

      {isMe ? (
        <LinearGradient
          colors={['#00E5FF', '#00B4D8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bubbleMe}
        >
          {senderName && <Text style={styles.senderMe}>{senderName}</Text>}
          
          {renderContent()}

          <View style={styles.metaRow}>
            <Text style={styles.timeMe}>{formattedTime}</Text>
            <Ionicons 
              name={item.is_read ? "checkmark-done" : "checkmark"} 
              size={14} 
              color={item.is_read ? "#003366" : "#0A192F"} 
              style={{ marginLeft: 4 }} 
            />
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.bubbleOther}>
          {senderName && <Text style={styles.senderOther}>{senderName}</Text>}
          
          {renderContent()}

          <View style={styles.metaRow}>
            <Text style={styles.timeOther}>{formattedTime}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 4,
    marginHorizontal: 12,
    alignItems: 'flex-end',
  },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#112240',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#233554',
    marginRight: 8,
    marginBottom: 4,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  avatarText: { color: '#00E5FF', fontSize: 12, fontWeight: 'bold' },
  bubbleMe: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#112240',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: '#233554',
  },
  senderMe: { color: '#0A192F', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  senderOther: { color: '#00E5FF', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  textMe: { color: '#0A192F', fontSize: 15, lineHeight: 20 },
  textOther: { color: '#E6F1FF', fontSize: 15, lineHeight: 20 },
  mediaImage: { width: 200, height: 150, borderRadius: 10, marginVertical: 4 },
  lottieContainer: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center' },
  lottieAnimation: { width: '100%', height: '100%' },
  viewOnceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  viewOnceButtonText: { color: '#FFD700', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  viewOnceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  viewOnceText: { color: '#8892B0', fontSize: 12, fontStyle: 'italic' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeMe: { color: '#0A192F', fontSize: 10, opacity: 0.8 },
  timeOther: { color: '#8892B0', fontSize: 10 },
});

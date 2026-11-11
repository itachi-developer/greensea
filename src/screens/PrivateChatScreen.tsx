import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar, Modal, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import { encryptMessage, decryptMessage } from '../lib/e2eEncryption';
import MessageBubble, { MessageItem } from '../components/MessageBubble';
import GifPickerModal from '../components/GifPickerModal';

export default function PrivateChatScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { roomId, userName } = route.params;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [gifModalVisible, setGifModalVisible] = useState(false);
  const [viewOnceModalVisible, setViewOnceModalVisible] = useState(false);
  const [selectedViewOnceItem, setSelectedViewOnceItem] = useState<MessageItem | null>(null);
  const [isViewOnceMode, setIsViewOnceMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef(0);
  const channelRef = useRef<any>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let subscription: any;

    const setupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Fetch messages with profiles join (ascending order)
      const { data, error } = await supabase
        .from('private_messages')
        .select('*, profiles(username, avatar_url)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const decryptedMessages = data.map((msg: any) => ({
          ...msg,
          content: msg.media_type === 'gif' ? msg.content : decryptMessage(msg.content, roomId)
        }));
        setMessages(decryptedMessages);
      }

      // Mark unread messages from other user as read
      await supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      subscription = supabase
        .channel(`room:${roomId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `room_id=eq.${roomId}` },
          async (payload) => {
            const newMsg = payload.new as MessageItem;
            newMsg.content = newMsg.media_type === 'gif' ? newMsg.content : decryptMessage(newMsg.content, roomId);
            
            // If message is from other user, mark as read immediately
            if (newMsg.sender_id !== user.id) {
              newMsg.is_read = true;
              await supabase
                .from('private_messages')
                .update({ is_read: true })
                .eq('id', newMsg.id);
            }

            setMessages((prev) => {
              if (prev.some(msg => msg.id === newMsg.id)) {
                return prev;
              }
              return [...prev, newMsg];
            });
          }
        )
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload.payload?.userId !== user.id) {
            setIsTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              setIsTyping(false);
            }, 3000);
          }
        })
        .subscribe();

      channelRef.current = subscription;
    };

    setupChat();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [roomId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleTextChange = (text: string) => {
    setInputText(text);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000 && currentUserId && channelRef.current) {
      lastTypingSentRef.current = now;
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId }
      });
    }
  };

  const sendMessage = async (mediaUrl?: string, mediaType: string = 'text') => {
    if (!currentUserId) return;
    if (mediaType === 'text' && !inputText.trim()) return;

    const textPayload = mediaType === 'gif' ? (inputText.trim() || 'GIF') : inputText.trim();
    const encryptedText = encryptMessage(textPayload, roomId);
    const tempText = inputText;
    setInputText('');

    const insertData: any = {
      room_id: roomId,
      sender_id: currentUserId,
      content: encryptedText,
      media_type: mediaType,
      is_view_once: isViewOnceMode,
      has_been_viewed: false,
      is_read: false,
    };

    if (mediaUrl) {
      insertData.media_url = mediaUrl;
    }

    const { error } = await supabase
      .from('private_messages')
      .insert([insertData]);

    if (error) {
      console.error("Errore invio messaggio E2EE:", error.message);
      setInputText(tempText);
    } else {
      setIsViewOnceMode(false);
    }
  };

  const sendGif = (gifUrl: string) => {
    setGifModalVisible(false);
    sendMessage(gifUrl, 'gif');
  };

  const handleOpenViewOnce = async (item: MessageItem) => {
    setSelectedViewOnceItem(item);
    setViewOnceModalVisible(true);

    if (!item.has_been_viewed) {
      await supabase
        .from('private_messages')
        .update({ has_been_viewed: true })
        .eq('id', item.id);

      setMessages(prev => prev.map(m => m.id === item.id ? { ...m, has_been_viewed: true } : m));
    }
  };

  const formatDateHeader = (dateString: string) => {
    const msgDate = new Date(dateString);
    const today = new Date();
    if (msgDate.toDateString() === today.toDateString()) {
      return "Oggi";
    }
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (msgDate.toDateString() === yesterday.toDateString()) {
      return "Ieri";
    }
    return msgDate.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getMessagesWithDateHeaders = (msgs: MessageItem[]) => {
    const list: any[] = [];
    let lastDateStr = '';

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : '';
      
      if (msgDate !== lastDateStr) {
        list.push({
          isDateHeader: true,
          id: `date-${msgDate}-${i}`,
          dateString: formatDateHeader(msg.created_at || new Date().toISOString())
        });
        lastDateStr = msgDate;
      }
      list.push(msg);
    }
    return list;
  };

  const handleDeletePrivateChat = () => {
    Alert.alert(
      "ELIMINA CHAT",
      "Vuoi eliminare questa conversazione e tutti i messaggi associati?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "ELIMINA",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_private_chat', { room_id_param: roomId });
              if (error) throw error;
              setMessages([]);
              navigation.goBack();
            } catch (err: any) {
              alert("Errore eliminazione chat: " + (err?.message || "Errore"));
            }
          }
        }
      ]
    );
  };

  const theme = {
    bg: '#050B14',
    headerBg: '#121624',
    border: '#233554',
    text: '#FFFFFF',
    subText: '#8892B0',
    inputBg: '#121624',
    accent: '#00E5FF',
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.accent} />
        </TouchableOpacity>

        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{(userName || 'A').charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.text }]}>{userName || 'Chat Privata'}</Text>
          <Text style={[styles.headerStatus, { color: theme.accent }]}>crittografia E2EE attiva</Text>
        </View>

        <TouchableOpacity onPress={handleDeletePrivateChat} style={{ padding: 8 }}>
          <Ionicons name="trash-outline" size={20} color="#FF0055" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <FlatList
          ref={flatListRef}
          data={getMessagesWithDateHeaders(messages)}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            if (item.isDateHeader) {
              return (
                <View style={{ alignItems: 'center', marginVertical: 12 }}>
                  <View style={{ backgroundColor: 'rgba(0, 229, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.2)' }}>
                    <Text style={{ color: '#00E5FF', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{item.dateString}</Text>
                  </View>
                </View>
              );
            }
            return (
              <MessageBubble 
                item={item} 
                currentUserId={currentUserId} 
                senderName={item.profiles?.username} 
                onOpenViewOnce={handleOpenViewOnce}
              />
            );
          }}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 100, flex: 1 }}>
              <Text style={{ color: theme.subText, fontSize: 14, fontStyle: 'italic', letterSpacing: 0.5 }}>Scrivi un messaggio</Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>L'agente sta scrivendo...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.inputBg, borderTopColor: theme.border }]}>
          {/* 1-Time Photo Toggle */}
          <TouchableOpacity 
            style={[styles.actionIconButton, isViewOnceMode && { backgroundColor: 'rgba(255, 215, 0, 0.2)', borderColor: '#FFD700' }]} 
            onPress={() => setIsViewOnceMode(!isViewOnceMode)}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={18} color={isViewOnceMode ? '#FFD700' : theme.subText} />
          </TouchableOpacity>

          {/* GIF Picker Button */}
          <TouchableOpacity 
            style={styles.actionIconButton} 
            onPress={() => setGifModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="image-outline" size={20} color={theme.accent} />
          </TouchableOpacity>

          <TextInput
            style={[styles.textInput, { color: theme.text, backgroundColor: '#050B14' }]}
            placeholder={isViewOnceMode ? "Scrivi foto 1-Time..." : "Messaggio cifrato..."}
            placeholderTextColor={theme.subText}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
          />

          <TouchableOpacity 
            style={[styles.sendButton, (!inputText.trim() && !isViewOnceMode) && { opacity: 0.5 }, { backgroundColor: theme.accent }]} 
            onPress={() => sendMessage()}
            activeOpacity={0.85}
            disabled={!inputText.trim() && !isViewOnceMode}
          >
            <Ionicons name="send" size={18} color="#050B14" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* GIF Picker Modal */}
      <GifPickerModal
        visible={gifModalVisible}
        onClose={() => setGifModalVisible(false)}
        onSelectGif={sendGif}
      />

      {/* View-Once Photo Modal */}
      <Modal visible={viewOnceModalVisible} transparent animationType="fade">
        <View style={styles.modalDarkOverlay}>
          <View style={styles.viewOnceModalContent}>
            <Text style={styles.viewOnceModalTitle}>FOTO 1-TIME (AUTODISTRUZIONE)</Text>
            {selectedViewOnceItem?.media_url ? (
              <Image source={{ uri: selectedViewOnceItem.media_url }} style={styles.viewOnceFullImage} resizeMode="contain" />
            ) : (
              <Text style={{ color: '#FFF', fontSize: 16 }}>{selectedViewOnceItem?.content}</Text>
            )}
            <TouchableOpacity 
              style={styles.closeViewOnceBtn}
              onPress={() => { setViewOnceModalVisible(false); setSelectedViewOnceItem(null); }}
            >
              <Text style={styles.closeViewOnceText}>CHIUDI E DISTRUGGI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { marginRight: 12 },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#050B14',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00E5FF',
    marginRight: 12,
  },
  headerAvatarText: { color: '#00E5FF', fontSize: 16, fontWeight: 'bold' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: 'bold' },
  headerStatus: { fontSize: 11 },
  keyboardView: { flex: 1, justifyContent: 'space-between' },
  chatList: { paddingVertical: 16 },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#121624',
    borderTopWidth: 1,
    borderTopColor: '#233554',
  },
  typingText: {
    color: '#00E5FF',
    fontSize: 11,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  textInput: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    marginHorizontal: 6,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDarkOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 },
  viewOnceModalContent: { width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' },
  viewOnceModalTitle: { color: '#FFD700', fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginBottom: 20 },
  viewOnceFullImage: { width: '100%', height: '70%', borderRadius: 16 },
  closeViewOnceBtn: { backgroundColor: '#FF0055', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 24 },
  closeViewOnceText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 }
});
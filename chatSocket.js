/**
 * Chat real-time – Socket.IO handlers (join room, send_message, typing, leave).
 * Call attachChatSocket(io) from your main server after creating the IO server.
 */

function toStr(v) {
  return v != null ? String(v) : '';
}

const chatRooms = new Map();
const userSockets = new Map();

function attachChatSocket(io) {
  io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    socket.on('register_user', (data) => {
      const { userId, userType } = data || {};
      if (!userId || !userType) return;
      userSockets.set(userId, { socketId: socket.id, userType });
    });

    socket.on('join_chat', (data) => {
      const chatId = toStr(data?.chatId);
      const { userId, userType } = data || {};
      if (!chatId) return;

      socket.join(chatId);
      if (!chatRooms.has(chatId)) chatRooms.set(chatId, new Set());
      chatRooms.get(chatId).add(socket.id);

      io.to(chatId).emit('user_connected', {
        userType,
        userId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('send_message', (data) => {
      const chatId = toStr(data?.chatId);
      const { senderId, senderType, message } = data || {};
      if (!chatId || !senderId || !message) return;

      io.to(chatId).emit('receive_message', {
        chatId,
        senderId,
        senderType: senderType || 'user',
        message: String(message).trim(),
        timestamp: new Date().toISOString(),
        received: true,
      });
    });

    socket.on('typing', (data) => {
      const chatId = toStr(data?.chatId);
      if (!chatId) return;
      socket.to(chatId).emit('user_typing', {
        userType: data?.userType,
        userId: data?.userId,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('stop_typing', (data) => {
      const chatId = toStr(data?.chatId);
      if (!chatId) return;
      socket.to(chatId).emit('user_stop_typing', {
        userType: data?.userType,
        userId: data?.userId,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('leave_chat', (data) => {
      const chatId = toStr(data?.chatId);
      const { userType, userId } = data || {};
      if (!chatId) return;

      if (chatRooms.has(chatId)) {
        chatRooms.get(chatId).delete(socket.id);
        if (chatRooms.get(chatId).size === 0) chatRooms.delete(chatId);
      }
      socket.leave(chatId);
      io.to(chatId).emit('user_disconnected', { userType, userId, timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      for (const [uid, info] of userSockets.entries()) {
        if (info.socketId === socket.id) {
          userSockets.delete(uid);
          break;
        }
      }
      for (const [roomId, set] of chatRooms.entries()) {
        set.delete(socket.id);
        if (set.size === 0) chatRooms.delete(roomId);
      }
    });

    socket.on('error', (err) => console.error('Socket error', socket.id, err));
  });
}

module.exports = { attachChatSocket };

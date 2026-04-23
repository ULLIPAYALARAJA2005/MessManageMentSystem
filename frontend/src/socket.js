import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export const socket = io(URL, {
    autoConnect: false,
    transports: ['websocket', 'polling']
});

import { io } from 'socket.io-client';

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

export const socket = io(URL, {
    autoConnect: false // We will connect manually when user logs in or app loads
});

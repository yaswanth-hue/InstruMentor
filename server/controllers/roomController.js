import { stateService } from '../services/stateService.js';
import { hashRoomPassword, verifyRoomPassword } from '../utils/passwordSecurity.js';

export const getRooms = async (req, res) => {
    const rooms = await stateService.getRooms();
    const publicRooms = rooms.map(({ password_hash, ...rest }) => rest);
    res.json(publicRooms);
};

export const createRoom = async (req, res) => {
    const {
        title, description, host_id, host_name, max_participants = 10,
        allow_chat = true, allow_media = false, is_private = false, password = null
    } = req.body;

    if (is_private && !password) {
        return res.status(400).json({ error: 'Password is required for private rooms' });
    }

    const password_hash = is_private ? await hashRoomPassword(password) : null;

    const newRoom = {
        id: Date.now().toString(),
        title, description, host_id, host_name, max_participants,
        is_active: true, allow_chat, allow_media, allow_screen_share: false,
        is_muted_by_default: false, is_private, password_hash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    await stateService.createRoom(newRoom);

    // Broadcast new room to all list-page clients (exclude password_hash)
    if (req.io) {
        const { password_hash: _omit, ...publicRoom } = newRoom;
        req.io.emit('room-created', publicRoom);
    }

    const { password_hash: _omit, ...publicRoom } = newRoom;
    res.json(publicRoom);
};

export const getRoom = async (req, res) => {
    const room = await stateService.getRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const { password_hash, ...publicRoom } = room;
    res.json(publicRoom);
};

export const verifyRoomAccess = async (req, res) => {
    const room = await stateService.getRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (!room.is_private || !room.password_hash) {
        return res.json({ valid: true });
    }

    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    const isValid = await verifyRoomPassword(password, room.password_hash);
    res.json({ valid: isValid });
};

export const updateRoomSettings = async (req, res) => {
    const { id } = req.params;
    const { allow_chat, allow_media, allow_screen_share, is_muted_by_default } = req.body;

    const updates = {};
    if (allow_chat !== undefined) updates.allow_chat = allow_chat;
    if (allow_media !== undefined) updates.allow_media = allow_media;
    if (allow_screen_share !== undefined) updates.allow_screen_share = allow_screen_share;
    if (is_muted_by_default !== undefined) updates.is_muted_by_default = is_muted_by_default;

    const updatedRoom = await stateService.updateRoom(id, updates);
    if (!updatedRoom) return res.status(404).json({ error: 'Room not found' });

    if (req.io) {
        req.io.to(id).emit('room-settings-updated', updates);
    }

    res.json(updatedRoom);
};

export const deleteRoom = async (req, res) => {
    const { id } = req.params;
    const room = await stateService.getRoom(id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    await stateService.deleteRoom(id);

    if (req.io) {
        req.io.to(id).emit('room-closed', { roomId: id });
        req.io.emit('room-deleted', { roomId: id });
    }

    res.json({ message: 'Room deleted successfully' });
};

export const getParticipants = async (req, res) => {
    const participants = await stateService.getParticipants(req.params.id);
    res.json(participants);
};

export const getMessages = async (req, res) => {
    const messages = await stateService.getMessages(req.params.id);
    res.json(messages);
};
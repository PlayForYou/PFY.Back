import {MusicRequest, RoomState, SocketServiceProps} from "../interfaces";

export async function isEmbeddable(videoId: string): Promise<boolean> {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    try {
      const res = await fetch(url);
      return res.ok; // 404 or 401이면 임베드 불가능
    } catch (err) {
      return false;
    }
  }

export const addMusic = (props: SocketServiceProps) => {
    const socket = props.connection.socket;
    const io = props.connection.io;
    const rooms = props.rooms;
    socket.on('add_music', async (request: MusicRequest) => {
        console.log(request);
        const isValid = await isEmbeddable(request.musicInfo.id);
        console.log(isValid);
        if (!isValid) {
            socket.emit('error_music', '이 영상은 퍼가기(임베드)가 제한되어 있습니다.');
            return;
        }
        // 큐에 영상 추가
        rooms[request.roomId].musicQueue.push(request.musicInfo);
        if(rooms[request.roomId].state === null){
            console.log('set');
            const roomState:RoomState = {
                currentMusic: request.musicInfo,
                endCount: 0,
                startedAt: Date.now(),
            };
            rooms[request.roomId].state = {...roomState};
            io.to(request.roomId).emit('music_state', roomState);
        }
        io.to(request.roomId).emit('playlist', rooms[request.roomId].musicQueue);
    });
}
export const getMusic = (props: SocketServiceProps) => {
    const socket = props.connection.socket;
    const io = props.connection.io;
    const rooms = props.rooms;
    socket.on('get_music',(roomId: string)=>{
        io.to(socket.id).emit('music_state', rooms[roomId].state);
        io.to(socket.id).emit('playlist', rooms[roomId].musicQueue);
    });
}
export const endMusic = (props: SocketServiceProps) => {
    const socket = props.connection.socket;
    const io = props.connection.io;
    const rooms = props.rooms;

    socket.on('end_music', (roomId: string) => {
        console.log(rooms[roomId].users);

        const connectedUsersCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;

        if (rooms[roomId].users.has(socket.id)) {
            if (rooms[roomId].state !== null) {
                console.log('end', socket.id, connectedUsersCount);
                rooms[roomId].state.endCount += 1;

                if (rooms[roomId].state.endCount >= connectedUsersCount) {
                    rooms[roomId].musicQueue = rooms[roomId].musicQueue.filter((_, index) => index !== 0);

                    if (rooms[roomId].musicQueue.length > 0) {
                        const nextRoomState: RoomState = {
                            currentMusic: rooms[roomId].musicQueue[0],
                            endCount: 0,
                            startedAt: Date.now(),
                        };
                        rooms[roomId].state = { ...nextRoomState };
                    } else {
                        rooms[roomId].state = null;
                    }
                }
            }

            io.to(roomId).emit('music_state', rooms[roomId].state);
            io.to(roomId).emit('playlist', rooms[roomId].musicQueue);
        }
    });
};
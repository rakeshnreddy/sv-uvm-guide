export interface UserEdit {
  user: string;
  content: string;
  timestamp: number;
}

/**
 * Establish a simple WebSocket connection for collaboration. The URL is
 * expected to point to a collaboration service.
 */
export function connectCollaboration(url: string): WebSocket | null {
  if (
    typeof window === 'undefined' ||
    typeof window.WebSocket === 'undefined'
  ) {
    return null;
  }

  const socket = new window.WebSocket(url);
  return socket;
}

/**
 * Send an edit event to the collaboration server so other users receive the
 * update. This is a placeholder; a real implementation would likely include
 * operational transform or CRDT logic.
 */
export function broadcastEdit(socket: WebSocket, edit: UserEdit) {
  socket.send(JSON.stringify({ type: "edit", edit }));
}

/**
 * Integrate with a version-control system by returning a commit-like object.
 * The current implementation simply wraps the content and user information.
 */
export function createVersion(edit: UserEdit) {
  return { message: `edit by ${edit.user}`, content: edit.content };
}

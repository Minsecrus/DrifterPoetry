export interface ParsedNote {
  id: number;
  text: string;
}

export type BodySegment =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "note";
      id: number;
      text: string;
    };

export interface ParsedBody {
  segments: BodySegment[];
  notes: ParsedNote[];
}

export function parseNotesDsl(body: string): ParsedBody {
  const segments: BodySegment[] = [];
  const notes: ParsedNote[] = [];
  let cursor = 0;

  while (cursor < body.length) {
    const start = body.indexOf("[[", cursor);

    if (start === -1) {
      pushText(segments, body.slice(cursor));
      break;
    }

    pushText(segments, body.slice(cursor, start));

    const end = body.indexOf("]]", start + 2);
    if (end === -1) {
      throw new Error("Unclosed note marker.");
    }

    const noteText = body.slice(start + 2, end);
    if (noteText.includes("[[") || noteText.includes("]]")) {
      throw new Error("Nested note markers are not supported.");
    }

    const id = notes.length + 1;
    const note = { id, text: noteText };
    notes.push(note);
    segments.push({ type: "note", ...note });
    cursor = end + 2;
  }

  return { segments, notes };
}

function pushText(segments: BodySegment[], text: string): void {
  if (text.length === 0) {
    return;
  }

  const previous = segments.at(-1);
  if (previous?.type === "text") {
    previous.text += text;
    return;
  }

  segments.push({ type: "text", text });
}

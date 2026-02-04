"""
Streaming utilities for handling response streaming in Flask.
Implements server-sent events for real-time message streaming.
"""

import json
from typing import Generator


def stream_response(generator: Generator) -> Generator[str, None, None]:
    """
    Wrap a generator to stream responses as Server-Sent Events (SSE).
    
    Each yielded item is formatted as: data: <json>\n\n
    """
    try:
        for item in generator:
            # Format as Server-Sent Event
            event_data = json.dumps({
                'type': 'chunk',
                'data': item
            })
            yield f"data: {event_data}\n\n"
        
        # Send completion signal
        completion = json.dumps({'type': 'done'})
        yield f"data: {completion}\n\n"
        
    except GeneratorExit:
        # Client disconnected
        pass
    except Exception as e:
        error_data = json.dumps({
            'type': 'error',
            'message': str(e)
        })
        yield f"data: {error_data}\n\n"


def format_streaming_chunk(chunk: str, chunk_type: str = 'text') -> str:
    """Format a single chunk for streaming."""
    return json.dumps({
        'type': chunk_type,
        'content': chunk,
        'timestamp': None
    })


def format_error_response(error: str) -> str:
    """Format error response."""
    return json.dumps({
        'type': 'error',
        'message': error
    })


def format_metadata(data: dict) -> str:
    """Format metadata for response."""
    return json.dumps({
        'type': 'metadata',
        'data': data
    })

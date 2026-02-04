"""
Export utilities for generating downloadable files.
Supports PDF, JSON, and Markdown exports.
"""

import json
import os
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def export_conversation_json(conversation: dict, messages: list) -> str:
    """Export conversation as JSON."""
    export_data = {
        'metadata': {
            'export_date': datetime.now().isoformat(),
            'conversation_id': conversation.get('id'),
            'title': conversation.get('title'),
            'created_at': conversation.get('created_at'),
            'message_count': len(messages)
        },
        'messages': messages
    }
    
    return json.dumps(export_data, indent=2)


def export_conversation_markdown(conversation: dict, messages: list) -> str:
    """Export conversation as Markdown."""
    md = f"# {conversation.get('title', 'Conversation')}\n\n"
    md += f"**Created:** {conversation.get('created_at')}\n"
    md += f"**Model:** {conversation.get('model_used', 'Unknown')}\n"
    md += f"**Messages:** {len(messages)}\n\n"
    md += "---\n\n"
    
    for msg in messages:
        role = msg.get('role', 'unknown').upper()
        content = msg.get('content', '')
        timestamp = msg.get('created_at', '')
        
        md += f"## {role}\n"
        md += f"*{timestamp}*\n\n"
        md += f"{content}\n\n"
        md += "---\n\n"
    
    return md


def export_conversation_pdf(conversation: dict, messages: list) -> Optional[bytes]:
    """
    Export conversation as PDF.
    Requires: reportlab or weasyprint
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
        from reportlab.lib.enums import TA_LEFT, TA_CENTER
        
        # Create PDF
        pdf_buffer = None
        doc = SimpleDocTemplate(
            f"export_{conversation.get('id')}.pdf",
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor='#0f172a',
            spaceAfter=6,
            alignment=TA_CENTER
        )
        story.append(Paragraph(conversation.get('title', 'Conversation'), title_style))
        
        # Metadata
        meta_style = ParagraphStyle(
            'Meta',
            parent=styles['Normal'],
            fontSize=10,
            textColor='#64748b',
            spaceAfter=12
        )
        story.append(Paragraph(
            f"Created: {conversation.get('created_at')} | Model: {conversation.get('model_used')}",
            meta_style
        ))
        
        story.append(Spacer(1, 0.2 * inch))
        
        # Messages
        for msg in messages:
            role = msg.get('role', 'unknown').upper()
            content = msg.get('content', '')
            
            # Role heading
            role_color = '#2563eb' if role == 'USER' else '#059669'
            role_style = ParagraphStyle(
                'RoleHeading',
                parent=styles['Heading3'],
                fontSize=12,
                textColor=role_color,
                spaceAfter=6
            )
            story.append(Paragraph(f"**{role}**", role_style))
            
            # Content
            content_style = ParagraphStyle(
                'Content',
                parent=styles['Normal'],
                fontSize=10,
                spaceAfter=12,
                leading=14
            )
            # Escape special characters for PDF
            safe_content = content.replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(safe_content[:500], content_style))
            
            story.append(Spacer(1, 0.1 * inch))
        
        # Build PDF
        doc.build(story)
        
        logger.info(f"✓ PDF exported for conversation {conversation.get('id')}")
        return True
        
    except ImportError:
        logger.warning("reportlab not installed - PDF export unavailable")
        return None
    except Exception as e:
        logger.error(f"Error exporting PDF: {str(e)}")
        return None


def get_export_filename(title: str, format: str) -> str:
    """Generate filename for export."""
    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_title = safe_title[:50]  # Limit length
    
    extensions = {
        'json': 'json',
        'markdown': 'md',
        'pdf': 'pdf'
    }
    
    ext = extensions.get(format, 'txt')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    return f"{safe_title}_{timestamp}.{ext}"

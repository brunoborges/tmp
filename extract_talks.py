#!/usr/bin/env python3
"""
Extract titles and abstracts from IBM events JSON data.
"""

import json
import re
from html import unescape


def clean_html(text):
    """Remove HTML tags and decode HTML entities from text."""
    if not text:
        return ""
    
    # Remove HTML tags
    clean = re.sub('<[^<]+?>', '', text)
    # Decode HTML entities
    clean = unescape(clean)
    # Clean up extra whitespace
    clean = ' '.join(clean.split())
    
    return clean


def extract_talks(json_file):
    """Extract title and abstract from talks in the JSON file."""
    
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        talks = []
        
        # Navigate through the JSON structure
        if 'sectionList' in data:
            for section in data['sectionList']:
                if 'items' in section:
                    for item in section['items']:
                        if 'title' in item:
                            talk = {
                                'title': item.get('title', 'No title'),
                                'abstract': clean_html(item.get('abstract', 'No abstract available')),
                                'code': item.get('code', 'No code'),
                                'type': item.get('type', 'Unknown type')
                            }
                            talks.append(talk)
        
        return talks
    
    except FileNotFoundError:
        print(f"Error: File '{json_file}' not found.")
        return []
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in file '{json_file}'.")
        return []
    except Exception as e:
        print(f"Error: {e}")
        return []


def save_to_csv(talks, output_file):
    """Save talks to a CSV file."""
    import csv
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['code', 'title', 'type', 'abstract'])
        writer.writeheader()
        writer.writerows(talks)


def save_to_text(talks, output_file):
    """Save talks to a readable text file."""
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"IBM Events - Talk Abstracts\n")
        f.write(f"{'='*50}\n\n")
        
        for i, talk in enumerate(talks, 1):
            f.write(f"{i}. {talk['title']}\n")
            f.write(f"   Code: {talk['code']}\n")
            f.write(f"   Type: {talk['type']}\n")
            f.write(f"   Abstract: {talk['abstract']}\n")
            f.write(f"{'-'*80}\n\n")


def main():
    """Main function to extract and save talk information."""
    
    # Extract talks from JSON
    print("Extracting talks from output.json...")
    talks = extract_talks('output.json')
    
    if not talks:
        print("No talks found or error occurred.")
        return
    
    print(f"Found {len(talks)} talks.")
    
    # Save to different formats
    save_to_csv(talks, 'talks.csv')
    save_to_text(talks, 'talks.txt')
    
    print("Data saved to:")
    print("- talks.csv (CSV format)")
    print("- talks.txt (readable text format)")
    
    # Display first few talks as preview
    print(f"\nPreview of first 3 talks:")
    print("=" * 50)
    
    for i, talk in enumerate(talks[:3], 1):
        print(f"\n{i}. {talk['title']}")
        print(f"   Type: {talk['type']}")
        print(f"   Abstract: {talk['abstract'][:200]}{'...' if len(talk['abstract']) > 200 else ''}")


if __name__ == "__main__":
    main()

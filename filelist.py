import os

def zeige_ordner_und_dateien(start_ordner="src"):
    if not os.path.exists(start_ordner):
        print(f"Der Ordner '{start_ordner}' existiert nicht.")
        return

    print(f"Inhalt von '{start_ordner}':")
    print("-" * 50)
    
    for wurzel, unterordner, dateien in os.walk(start_ordner, followlinks=True):
        # 1. Zeige den aktuellen Ordner an
        print(f"[Ordner] {wurzel}")
        
        # 2. Zeige alle Dateien in diesem Ordner an
        for datei in dateien:
            dateipfad = os.path.join(wurzel, datei)
            print(f"  └── [Datei] {datei}")

if __name__ == "__main__":
    zeige_ordner_und_dateien()
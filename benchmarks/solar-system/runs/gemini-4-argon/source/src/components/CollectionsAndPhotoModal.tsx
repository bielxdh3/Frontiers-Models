import React, { useMemo, useRef, useState } from 'react';
import {
  ActiveTool,
  CameraMode,
  JournalEntry,
  LabelMode,
  Language,
  OrbitMode,
  PersistedStoreV1,
  SavedViewpoint,
  ScaleMode,
} from '../types/solarSystem';
import { CATALOG_BY_ID, CELESTIAL_CATALOG, normalizeSearchText } from '../data/celestialCatalog';
import {
  encodeShareableSceneUrl,
  validateAndRecoverStore,
} from '../utils/storage';
import { formatSimulationDateUtc } from '../utils/formatters';
import {
  Bookmark,
  Camera,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  FileJson,
  Grid,
  NotebookPen,
  Plus,
  Share2,
  Star,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';

export interface PhotoModeSettings {
  fov: number;
  aspectGuide: 'viewport' | '16:9' | '4:3' | '1:1';
  showRuleOfThirds: boolean;
  includeCaption: boolean;
  includeLabelsInExport: boolean;
}

interface CollectionsAndPhotoModalProps {
  activeTool: ActiveTool;
  locale: Language;
  selectedBodyId: string;
  simTimeMs: number;
  isPlaying: boolean;
  scaleMode: ScaleMode;
  cameraMode: CameraMode;
  labelMode: LabelMode;
  orbitMode: OrbitMode;
  ambientExposure: number;
  backgroundIntensity: number;
  store: PersistedStoreV1;
  photoSettings: PhotoModeSettings;
  onUpdatePhotoSettings: (next: PhotoModeSettings) => void;
  onUpdateStore: (updater: (prev: PersistedStoreV1) => PersistedStoreV1) => void;
  onSelectBody: (id: string) => void;
  onSetSimTimeMs: (ms: number, pause?: boolean) => void;
  onTogglePlay: () => void;
  onSetScaleMode: (mode: ScaleMode) => void;
  onSetLabelMode: (mode: LabelMode) => void;
  onSetOrbitMode: (mode: OrbitMode) => void;
  onSetAmbientExposure: (val: number) => void;
  onSetBackgroundIntensity: (val: number) => void;
  onApplyViewpoint: (vp: SavedViewpoint, restoreDate: boolean) => void;
  onCloseTool: () => void;
}

export const CollectionsAndPhotoModal: React.FC<CollectionsAndPhotoModalProps> = ({
  activeTool,
  locale,
  selectedBodyId,
  simTimeMs,
  isPlaying,
  scaleMode,
  cameraMode,
  labelMode,
  orbitMode,
  ambientExposure,
  backgroundIntensity,
  store,
  photoSettings,
  onUpdatePhotoSettings,
  onUpdateStore,
  onSelectBody,
  onSetSimTimeMs,
  onTogglePlay,
  onSetScaleMode,
  onSetLabelMode,
  onSetOrbitMode,
  onSetAmbientExposure,
  onSetBackgroundIntensity,
  onApplyViewpoint,
  onCloseTool,
}) => {
  const [collectionsTab, setCollectionsTab] = useState<
    'favorites' | 'viewpoints' | 'journal' | 'share_export'
  >('viewpoints');
  const [searchQuery, setSearchQuery] = useState('');
  const [restoreSavedDateDefault, setRestoreSavedDateDefault] = useState(true);

  // New / Editing Viewpoint State
  const [newVpTitle, setNewVpTitle] = useState('');
  const [editingVpId, setEditingVpId] = useState<string | null>(null);
  const [editingVpTitle, setEditingVpTitle] = useState('');
  const [confirmClearVps, setConfirmClearVps] = useState(false);

  // New / Editing Journal Entry State
  const [newJournalTitle, setNewJournalTitle] = useState('');
  const [newJournalNote, setNewJournalNote] = useState('');
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [editingJournalTitle, setEditingJournalTitle] = useState('');
  const [editingJournalNote, setEditingJournalNote] = useState('');
  const [confirmClearJournal, setConfirmClearJournal] = useState(false);

  // Share & JSON Import/Export State
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    parsedStore: PersistedStoreV1;
    warnings: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Photo & Video Capture State
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const selectedBody = CATALOG_BY_ID[selectedBodyId] || CELESTIAL_CATALOG[0];

  // Save current viewpoint
  const handleSaveCurrentViewpoint = () => {
    const title =
      newVpTitle.trim() ||
      `${selectedBody.name[locale]} (${formatSimulationDateUtc(simTimeMs, locale).slice(0, 12)})`;
    const newVp: SavedViewpoint = {
      id: `vp_${Date.now()}`,
      title,
      targetId: selectedBodyId,
      cameraMode,
      cameraOffset: { x: 4.5, y: 2.2, z: 4.5 },
      simTimeMs,
      restoreDateOnVisit: restoreSavedDateDefault,
      scaleMode,
      labelMode,
      orbitMode,
      createdAt: new Date().toISOString(),
    };
    onUpdateStore((prev) => ({
      ...prev,
      savedViewpoints: [newVp, ...prev.savedViewpoints],
    }));
    setNewVpTitle('');
  };

  // Save new journal observation
  const handleAddJournalEntry = () => {
    if (!newJournalTitle.trim() && !newJournalNote.trim()) return;
    const nowIso = new Date().toISOString();
    const entry: JournalEntry = {
      id: `je_${Date.now()}`,
      title:
        newJournalTitle.trim() ||
        `${locale === 'pt-BR' ? 'Observação:' : 'Observation:'} ${selectedBody.name[locale]}`,
      note: newJournalNote.trim(),
      bodyId: selectedBodyId,
      simTimeMs,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    onUpdateStore((prev) => ({
      ...prev,
      journalEntries: [entry, ...prev.journalEntries],
    }));
    setNewJournalTitle('');
    setNewJournalNote('');
  };

  // Filtered lists
  const normalizedSearch = normalizeSearchText(searchQuery);

  const filteredFavorites = useMemo(() => {
    return store.favorites
      .map((id) => CATALOG_BY_ID[id])
      .filter((b): b is NonNullable<typeof b> => {
        if (!b) return false;
        if (!normalizedSearch) return true;
        return normalizeSearchText(`${b.name['pt-BR']} ${b.name.en}`).includes(
          normalizedSearch
        );
      });
  }, [store.favorites, normalizedSearch]);

  const filteredViewpoints = useMemo(() => {
    return store.savedViewpoints.filter((vp) => {
      if (!normalizedSearch) return true;
      const bodyName = CATALOG_BY_ID[vp.targetId]?.name[locale] || vp.targetId;
      return normalizeSearchText(`${vp.title} ${bodyName}`).includes(normalizedSearch);
    });
  }, [store.savedViewpoints, normalizedSearch, locale]);

  const filteredJournal = useMemo(() => {
    return store.journalEntries.filter((je) => {
      if (!normalizedSearch) return true;
      const bodyName = CATALOG_BY_ID[je.bodyId]?.name[locale] || je.bodyId;
      return normalizeSearchText(`${je.title} ${je.note} ${bodyName}`).includes(
        normalizedSearch
      );
    });
  }, [store.journalEntries, normalizedSearch, locale]);

  // Export JSON collection
  const handleExportJson = () => {
    const payload = JSON.stringify(store, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `observatorio-sistema-solar-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Parse untrusted JSON file for preview before applying
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportPreview(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setImportError(
        locale === 'pt-BR'
          ? 'Arquivo excede o limite de segurança de 2 MB.'
          : 'File exceeds the 2 MB safety limit.'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const { store: validated, warnings } = validateAndRecoverStore(raw);
        setImportPreview({ parsedStore: validated, warnings });
      } catch {
        setImportError(
          locale === 'pt-BR'
            ? 'Arquivo JSON inválido ou malformado. Nenhuma alteração foi aplicada.'
            : 'Invalid or malformed JSON file. No changes were applied.'
        );
      }
    };
    reader.readAsText(file);
  };

  // Snapshot Export (1x or 2x PNG)
  const handleCapturePng = (scaleFactor: 1 | 2) => {
    const glCanvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!glCanvas) return;

    const width = glCanvas.width * scaleFactor;
    const height = glCanvas.height * scaleFactor;
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(glCanvas, 0, 0, width, height);

    // Optional compositing of visible 2D labels
    if (photoSettings.includeLabelsInExport && labelMode !== 'none') {
      const labelNodes = document.querySelectorAll('[data-scene-label="true"]');
      const canvasRect = glCanvas.getBoundingClientRect();
      ctx.save();
      ctx.font = `600 ${Math.round(12 * scaleFactor * window.devicePixelRatio)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      labelNodes.forEach((node) => {
        const el = node as HTMLElement;
        const rect = el.getBoundingClientRect();
        const x = ((rect.left + rect.width / 2 - canvasRect.left) / canvasRect.width) * width;
        const y = ((rect.top + rect.height / 2 - canvasRect.top) / canvasRect.height) * height;
        const text = el.innerText.trim();
        if (text && x >= 0 && x <= width && y >= 0 && y <= height) {
          ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
          const metrics = ctx.measureText(text);
          const padX = 8 * scaleFactor;
          const padY = 5 * scaleFactor;
          ctx.fillRect(
            x - metrics.width / 2 - padX,
            y - 10 * scaleFactor - padY,
            metrics.width + padX * 2,
            20 * scaleFactor + padY
          );
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(text, x, y + 4 * scaleFactor);
        }
      });
      ctx.restore();
    }

    // Optional scientific caption bar at bottom
    if (photoSettings.includeCaption) {
      const barH = Math.round(44 * scaleFactor);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
      ctx.fillRect(0, height - barH, width, barH);
      ctx.fillStyle = '#38bdf8';
      ctx.font = `bold ${Math.round(14 * scaleFactor)}px Inter, sans-serif`;
      const titleText = `Observatório do Sistema Solar • ${selectedBody.name[locale]}`;
      ctx.fillText(titleText, 18 * scaleFactor, height - Math.round(16 * scaleFactor));

      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.round(12 * scaleFactor)}px JetBrains Mono, monospace`;
      const metaText = `${formatSimulationDateUtc(simTimeMs, locale)} • ${
        scaleMode === 'exploration'
          ? locale === 'pt-BR'
            ? 'Escala de Exploração'
            : 'Exploration Scale'
          : locale === 'pt-BR'
          ? 'Escala Relativa'
          : 'Relative Scale'
      }`;
      const metaWidth = ctx.measureText(metaText).width;
      ctx.fillText(
        metaText,
        Math.max(260 * scaleFactor, width - metaWidth - 18 * scaleFactor),
        height - Math.round(16 * scaleFactor)
      );
    }

    const dataUrl = offscreen.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `observatorio-${selectedBodyId}-${scaleFactor}x.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setRecordingMessage(
      locale === 'pt-BR'
        ? `Imagem PNG (${scaleFactor}x) exportada com sucesso!`
        : `PNG snapshot (${scaleFactor}x) exported!`
    );
    window.setTimeout(() => setRecordingMessage(null), 3500);
  };

  // Short Loop WebM Video Capture (5s)
  const handleToggleVideoCapture = () => {
    const glCanvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (
      !glCanvas ||
      typeof MediaRecorder === 'undefined' ||
      typeof glCanvas.captureStream !== 'function'
    ) {
      setRecordingMessage(
        locale === 'pt-BR'
          ? 'Gravação de vídeo (MediaRecorder) não é suportada neste navegador. Use a captura PNG 1x/2x.'
          : 'Video capture (MediaRecorder) is not supported in this browser. Use 1x/2x PNG export.'
      );
      return;
    }

    if (isRecordingVideo && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
      return;
    }

    try {
      const stream = glCanvas.captureStream(30);
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `observatorio-${selectedBodyId}-loop.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsRecordingVideo(false);
        setRecordingMessage(
          locale === 'pt-BR'
            ? 'Clipe WebM exportado com sucesso!'
            : 'WebM video loop exported!'
        );
      };

      recorder.start();
      setIsRecordingVideo(true);
      setRecordingMessage(
        locale === 'pt-BR'
          ? 'Gravando clipe de 6 segundos... clique novamente para concluir.'
          : 'Recording 6-second loop... click again to stop early.'
      );
      window.setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 6000);
    } catch {
      setRecordingMessage(
        locale === 'pt-BR'
          ? 'Não foi possível iniciar a gravação de vídeo neste ambiente.'
          : 'Could not start video capture in this browser environment.'
      );
    }
  };

  const shareUrl = useMemo(
    () =>
      encodeShareableSceneUrl({
        v: 1,
        target: selectedBodyId,
        time: simTimeMs,
        scale: scaleMode,
        mode: cameraMode,
        labels: labelMode,
        orbits: orbitMode,
      }),
    [selectedBodyId, simTimeMs, scaleMode, cameraMode, labelMode, orbitMode]
  );

  return (
    <>
      {/* PHOTO MODE NON-BLOCKING COMPOSITION OVERLAY & GUIDES */}
      {activeTool === 'photo_mode' && (
        <>
          {/* Framing & Rule of Thirds Guide Overlay */}
          <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center">
            <div
              className={`relative border border-cyan-400/35 transition-all ${
                photoSettings.aspectGuide === '16:9'
                  ? 'w-[86vw] max-h-[82vh] aspect-video'
                  : photoSettings.aspectGuide === '4:3'
                  ? 'h-[80vh] max-w-[88vw] aspect-[4/3]'
                  : photoSettings.aspectGuide === '1:1'
                  ? 'h-[78vh] max-w-[78vw] aspect-square'
                  : 'w-full h-full border-none'
              }`}
            >
              {photoSettings.showRuleOfThirds && (
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <div key={idx} className="border border-slate-200/15" />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Composition Studio Bar */}
          <aside
            aria-label={locale === 'pt-BR' ? 'Estúdio de Modo Foto' : 'Photo Mode Studio'}
            data-testid="photo-mode-hud"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[96vw] max-w-4xl bg-slate-950/94 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl p-3.5 text-slate-100 pointer-events-auto space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  {locale === 'pt-BR'
                    ? 'Modo Foto e Captura Cinematográfica'
                    : 'Photo Mode & Cinematic Capture'}
                </span>
              </div>

              {/* Cinematic Viewpoint Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    id: 'earth',
                    label: locale === 'pt-BR' ? 'Terra no Terminador' : 'Earth Terminator',
                  },
                  {
                    id: 'saturn',
                    label: locale === 'pt-BR' ? 'Saturno e Anéis' : 'Saturn & Rings',
                  },
                  {
                    id: 'jupiter',
                    label: locale === 'pt-BR' ? 'Júpiter e Luas' : 'Jupiter & Moons',
                  },
                  {
                    id: 'pluto',
                    label: locale === 'pt-BR' ? 'Plutão–Caronte' : 'Pluto–Charon',
                  },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectBody(preset.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                      selectedBodyId === preset.id
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={onCloseTool}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-700/50"
                >
                  <X className="w-3.5 h-3.5" />
                  {locale === 'pt-BR' ? 'Sair do Modo Foto' : 'Exit Photo Mode'}
                </button>
              </div>
            </div>

            {/* Sliders & Framing Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {locale === 'pt-BR' ? 'Campo de Visão (FOV)' : 'Field of View (FOV)'}
                  </span>
                  <span className="font-mono text-cyan-300">{photoSettings.fov}°</span>
                </div>
                <input
                  type="range"
                  min={22}
                  max={75}
                  step={1}
                  value={photoSettings.fov}
                  onChange={(e) =>
                    onUpdatePhotoSettings({ ...photoSettings, fov: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {locale === 'pt-BR' ? 'Exposição Ambiental' : 'Ambient Exposure'}
                  </span>
                  <span className="font-mono text-cyan-300">
                    {Math.round(ambientExposure * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.85}
                  step={0.05}
                  value={ambientExposure}
                  onChange={(e) => onSetAmbientExposure(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {locale === 'pt-BR' ? 'Fundo Estelar' : 'Starfield Intensity'}
                  </span>
                  <span className="font-mono text-cyan-300">
                    {Math.round(backgroundIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={backgroundIntensity}
                  onChange={(e) => onSetBackgroundIntensity(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePhotoSettings({
                      ...photoSettings,
                      showRuleOfThirds: !photoSettings.showRuleOfThirds,
                    })
                  }
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border ${
                    photoSettings.showRuleOfThirds
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  {locale === 'pt-BR' ? 'Regra dos Terços' : 'Rule of Thirds'}
                </button>

                <select
                  aria-label={locale === 'pt-BR' ? 'Proporção de enquadramento' : 'Aspect ratio guide'}
                  value={photoSettings.aspectGuide}
                  onChange={(e) =>
                    onUpdatePhotoSettings({
                      ...photoSettings,
                      aspectGuide: e.target.value as PhotoModeSettings['aspectGuide'],
                    })
                  }
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                >
                  <option value="viewport">
                    {locale === 'pt-BR' ? 'Quadro Livre' : 'Full Viewport'}
                  </option>
                  <option value="16:9">16:9</option>
                  <option value="4:3">4:3</option>
                  <option value="1:1">1:1</option>
                </select>

                <button
                  type="button"
                  onClick={() => onSetLabelMode(labelMode === 'none' ? 'major' : 'none')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border ${
                    labelMode !== 'none'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {locale === 'pt-BR' ? 'Rótulos' : 'Labels'}
                </button>

                <button
                  type="button"
                  onClick={() => onSetOrbitMode(orbitMode === 'none' ? 'all' : 'none')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border ${
                    orbitMode !== 'none'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {locale === 'pt-BR' ? 'Órbitas' : 'Orbits'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onUpdatePhotoSettings({
                      ...photoSettings,
                      includeCaption: !photoSettings.includeCaption,
                    })
                  }
                  className={`px-2.5 py-1.5 rounded-lg text-xs border ${
                    photoSettings.includeCaption
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {locale === 'pt-BR' ? 'Legenda Científica' : 'Scientific Caption'}
                </button>

                <button
                  type="button"
                  onClick={onTogglePlay}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
                >
                  {isPlaying
                    ? locale === 'pt-BR'
                      ? 'Congelar Movimento'
                      : 'Freeze Motion'
                    : locale === 'pt-BR'
                    ? 'Retomar Movimento'
                    : 'Resume Motion'}
                </button>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="capture-png-1x"
                  onClick={() => handleCapturePng(1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                >
                  <Download className="w-3.5 h-3.5" />
                  PNG 1x
                </button>
                <button
                  type="button"
                  data-testid="capture-png-2x"
                  onClick={() => handleCapturePng(2)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  PNG 2x
                </button>
                <button
                  type="button"
                  onClick={handleToggleVideoCapture}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                    isRecordingVideo
                      ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  {isRecordingVideo
                    ? locale === 'pt-BR'
                      ? 'Parar Vídeo'
                      : 'Stop Video'
                    : 'WebM (6s)'}
                </button>
              </div>
            </div>

            {recordingMessage && (
              <div className="text-xs text-cyan-300 font-medium text-center pt-1">
                {recordingMessage}
              </div>
            )}
          </aside>
        </>
      )}

      {/* COLLECTIONS, SAVED VIEWPOINTS, JOURNAL & SHARE MODAL */}
      {activeTool === 'collections' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            locale === 'pt-BR'
              ? 'Favoritos, Vistas Salvas, Diário de Observação e Compartilhamento'
              : 'Favorites, Saved Viewpoints, Observation Journal & Share'
          }
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md"
        >
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            {/* Header & Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-900/90 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCollectionsTab('viewpoints')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    collectionsTab === 'viewpoints'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {locale === 'pt-BR'
                    ? `Vistas Salvas (${store.savedViewpoints.length})`
                    : `Saved Views (${store.savedViewpoints.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionsTab('favorites')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    collectionsTab === 'favorites'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  {locale === 'pt-BR'
                    ? `Favoritos (${store.favorites.length})`
                    : `Favorites (${store.favorites.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionsTab('journal')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    collectionsTab === 'journal'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <NotebookPen className="w-3.5 h-3.5" />
                  {locale === 'pt-BR'
                    ? `Diário (${store.journalEntries.length})`
                    : `Journal (${store.journalEntries.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionsTab('share_export')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    collectionsTab === 'share_export'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {locale === 'pt-BR' ? 'Compartilhar e JSON' : 'Share & JSON'}
                </button>
              </div>

              <button
                type="button"
                onClick={onCloseTool}
                aria-label={locale === 'pt-BR' ? 'Fechar coleções' : 'Close collections'}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {collectionsTab !== 'share_export' && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      locale === 'pt-BR'
                        ? 'Filtrar por título, corpo ou anotação...'
                        : 'Filter by title, body, or note...'
                    }
                    className="flex-1 min-w-[200px] bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                  />
                </div>
              )}

              {/* SAVED VIEWPOINTS TAB */}
              {collectionsTab === 'viewpoints' && (
                <div className="space-y-4">
                  {/* Save Current Viewpoint Form */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                    <div className="text-xs font-bold text-cyan-400">
                      {locale === 'pt-BR'
                        ? 'Salvar Vista Atual da Cena'
                        : 'Save Current Scene Viewpoint'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={newVpTitle}
                        onChange={(e) => setNewVpTitle(e.target.value)}
                        placeholder={
                          locale === 'pt-BR'
                            ? `Ex.: ${selectedBody.name[locale]} em ${scaleMode === 'exploration' ? 'Exploração' : 'Escala Relativa'}`
                            : `E.g., ${selectedBody.name[locale]} in ${scaleMode}`
                        }
                        className="flex-1 min-w-[220px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                      />
                      <button
                        type="button"
                        data-testid="save-current-viewpoint-btn"
                        onClick={handleSaveCurrentViewpoint}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {locale === 'pt-BR' ? 'Salvar Vista' : 'Save View'}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restoreSavedDateDefault}
                          onChange={(e) => setRestoreSavedDateDefault(e.target.checked)}
                          className="rounded accent-cyan-400"
                        />
                        <span>
                          {locale === 'pt-BR'
                            ? 'Restaurar a data salva ao abrir vistas (desmarque para manter o relógio atual)'
                            : 'Restore saved date when opening viewpoints (uncheck to keep current clock)'}
                        </span>
                      </label>

                      {store.savedViewpoints.length > 0 && (
                        <div>
                          {!confirmClearVps ? (
                            <button
                              type="button"
                              onClick={() => setConfirmClearVps(true)}
                              className="text-[11px] text-rose-400 hover:underline"
                            >
                              {locale === 'pt-BR' ? 'Limpar Todas as Vistas' : 'Clear All Views'}
                            </button>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateStore((prev) => ({ ...prev, savedViewpoints: [] }));
                                  setConfirmClearVps(false);
                                }}
                                className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px]"
                              >
                                {locale === 'pt-BR' ? 'Confirmar Exclusão' : 'Confirm Clear'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmClearVps(false)}
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]"
                              >
                                {locale === 'pt-BR' ? 'Cancelar' : 'Cancel'}
                              </button>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* List of Saved Viewpoints */}
                  <div className="space-y-2">
                    {filteredViewpoints.map((vp) => {
                      const body = CATALOG_BY_ID[vp.targetId];
                      const isEditing = editingVpId === vp.id;
                      return (
                        <div
                          key={vp.id}
                          className="p-3 rounded-xl bg-slate-900/75 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5 flex-1 min-w-[200px]">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingVpTitle}
                                  onChange={(e) => setEditingVpTitle(e.target.value)}
                                  className="bg-slate-950 border border-cyan-500 rounded px-2 py-1 text-xs text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateStore((prev) => ({
                                      ...prev,
                                      savedViewpoints: prev.savedViewpoints.map((item) =>
                                        item.id === vp.id
                                          ? { ...item, title: editingVpTitle.trim() || item.title }
                                          : item
                                      ),
                                    }));
                                    setEditingVpId(null);
                                  }}
                                  className="px-2 py-1 rounded bg-cyan-500 text-slate-950 text-xs font-bold"
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-white">{vp.title}</div>
                            )}
                            <div className="text-[11px] text-slate-400">
                              {body?.name[locale] || vp.targetId} •{' '}
                              {formatSimulationDateUtc(vp.simTimeMs, locale)} •{' '}
                              {vp.scaleMode === 'exploration'
                                ? locale === 'pt-BR'
                                  ? 'Escala de Exploração'
                                  : 'Exploration Scale'
                                : locale === 'pt-BR'
                                ? 'Escala Relativa'
                                : 'Relative Scale'}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onApplyViewpoint(vp, restoreSavedDateDefault);
                                onCloseTool();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {locale === 'pt-BR' ? 'Abrir Vista' : 'Open View'}
                            </button>
                            <button
                              type="button"
                              title={locale === 'pt-BR' ? 'Renomear' : 'Rename'}
                              onClick={() => {
                                setEditingVpId(vp.id);
                                setEditingVpTitle(vp.title);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title={locale === 'pt-BR' ? 'Duplicar' : 'Duplicate'}
                              onClick={() => {
                                const dup: SavedViewpoint = {
                                  ...vp,
                                  id: `vp_${Date.now()}`,
                                  title: `${vp.title} (Cópia)`,
                                  createdAt: new Date().toISOString(),
                                };
                                onUpdateStore((prev) => ({
                                  ...prev,
                                  savedViewpoints: [dup, ...prev.savedViewpoints],
                                }));
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title={locale === 'pt-BR' ? 'Excluir' : 'Delete'}
                              onClick={() =>
                                onUpdateStore((prev) => ({
                                  ...prev,
                                  savedViewpoints: prev.savedViewpoints.filter(
                                    (item) => item.id !== vp.id
                                  ),
                                }))
                              }
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-rose-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FAVORITES TAB */}
              {collectionsTab === 'favorites' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredFavorites.map((body) => (
                    <div
                      key={body.id}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: body.visual.primaryColor }}
                        />
                        <div>
                          <div className="text-xs font-bold text-white">{body.name[locale]}</div>
                          <div className="text-[11px] text-slate-400">
                            {(body.semiMajorAxisAu ?? 0).toFixed(2)} UA
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBody(body.id);
                            onCloseTool();
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                        >
                          {locale === 'pt-BR' ? 'Focar' : 'Focus'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateStore((prev) => ({
                              ...prev,
                              favorites: prev.favorites.filter((id) => id !== body.id),
                            }))
                          }
                          className="p-1.5 rounded-lg bg-slate-800 text-rose-300 hover:bg-rose-950"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* OBSERVATION JOURNAL TAB */}
              {collectionsTab === 'journal' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-400">
                        {locale === 'pt-BR'
                          ? `Nova Nota no Diário (${selectedBody.name[locale]})`
                          : `New Journal Entry (${selectedBody.name[locale]})`}
                      </span>
                      {store.journalEntries.length > 0 && !confirmClearJournal && (
                        <button
                          type="button"
                          onClick={() => setConfirmClearJournal(true)}
                          className="text-[11px] text-rose-400 hover:underline"
                        >
                          {locale === 'pt-BR' ? 'Limpar Diário' : 'Clear Journal'}
                        </button>
                      )}
                      {confirmClearJournal && (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateStore((prev) => ({ ...prev, journalEntries: [] }));
                              setConfirmClearJournal(false);
                            }}
                            className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px]"
                          >
                            {locale === 'pt-BR' ? 'Confirmar' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClearJournal(false)}
                            className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]"
                          >
                            {locale === 'pt-BR' ? 'Cancelar' : 'Cancel'}
                          </button>
                        </span>
                      )}
                    </div>

                    <input
                      type="text"
                      value={newJournalTitle}
                      onChange={(e) => setNewJournalTitle(e.target.value)}
                      placeholder={
                        locale === 'pt-BR'
                          ? 'Título da observação...'
                          : 'Observation title...'
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                    <textarea
                      rows={2}
                      value={newJournalNote}
                      onChange={(e) => setNewJournalNote(e.target.value)}
                      placeholder={
                        locale === 'pt-BR'
                          ? 'Registre suas observações sobre órbitas, fases, eclipses ou comparações...'
                          : 'Record your notes on orbits, phases, eclipses, or comparisons...'
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100"
                    />
                    <button
                      type="button"
                      data-testid="add-journal-entry-btn"
                      onClick={handleAddJournalEntry}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {locale === 'pt-BR' ? 'Registrar Observação' : 'Save Observation'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {filteredJournal.map((je) => {
                      const body = CATALOG_BY_ID[je.bodyId];
                      const isEditing = editingJournalId === je.id;
                      return (
                        <div
                          key={je.id}
                          className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2"
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editingJournalTitle}
                                onChange={(e) => setEditingJournalTitle(e.target.value)}
                                className="w-full bg-slate-950 border border-cyan-500 rounded px-2.5 py-1 text-xs text-white"
                              />
                              <textarea
                                rows={2}
                                value={editingJournalNote}
                                onChange={(e) => setEditingJournalNote(e.target.value)}
                                className="w-full bg-slate-950 border border-cyan-500 rounded p-2 text-xs text-white"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateStore((prev) => ({
                                    ...prev,
                                    journalEntries: prev.journalEntries.map((item) =>
                                      item.id === je.id
                                        ? {
                                            ...item,
                                            title: editingJournalTitle.trim() || item.title,
                                            note: editingJournalNote,
                                            updatedAt: new Date().toISOString(),
                                          }
                                        : item
                                    ),
                                  }));
                                  setEditingJournalId(null);
                                }}
                                className="px-3 py-1 rounded bg-cyan-500 text-slate-950 text-xs font-bold"
                              >
                                {locale === 'pt-BR' ? 'Salvar Alterações' : 'Save Changes'}
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-xs font-bold text-white">{je.title}</div>
                                  <div className="text-[11px] text-slate-400">
                                    {body?.name[locale] || je.bodyId} •{' '}
                                    {formatSimulationDateUtc(je.simTimeMs, locale)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectBody(je.bodyId);
                                      onSetSimTimeMs(je.simTimeMs, true);
                                      onCloseTool();
                                    }}
                                    className="px-2 py-1 rounded text-[11px] bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                                  >
                                    {locale === 'pt-BR' ? 'Ir para Cena' : 'Open Scene'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingJournalId(je.id);
                                      setEditingJournalTitle(je.title);
                                      setEditingJournalNote(je.note);
                                    }}
                                    className="p-1.5 rounded bg-slate-800 text-slate-300"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const dup: JournalEntry = {
                                        ...je,
                                        id: `je_${Date.now()}`,
                                        title: `${je.title} (Cópia)`,
                                      };
                                      onUpdateStore((prev) => ({
                                        ...prev,
                                        journalEntries: [dup, ...prev.journalEntries],
                                      }));
                                    }}
                                    className="p-1.5 rounded bg-slate-800 text-slate-300"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateStore((prev) => ({
                                        ...prev,
                                        journalEntries: prev.journalEntries.filter(
                                          (item) => item.id !== je.id
                                        ),
                                      }))
                                    }
                                    className="p-1.5 rounded bg-slate-800 text-rose-300"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {je.note && (
                                <p className="text-xs text-slate-300 whitespace-pre-wrap">
                                  {je.note}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SHARE URL & JSON IMPORT/EXPORT TAB */}
              {collectionsTab === 'share_export' && (
                <div className="space-y-5">
                  {/* Bounded Shareable URL */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                    <h3 className="text-sm font-bold text-white">
                      {locale === 'pt-BR'
                        ? 'Compartilhar Link da Vista Atual (Sem Notas Privadas)'
                        : 'Share Current View Link (No Private Notes)'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {locale === 'pt-BR'
                        ? 'Este link codifica apenas o corpo selecionado, data UTC, modo de escala e sobreposições visuais.'
                        : 'This link encodes only the selected body, UTC date, scale mode, and visual overlays.'}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(shareUrl);
                          setCopiedShareUrl(true);
                          window.setTimeout(() => setCopiedShareUrl(false), 2500);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-slate-950"
                      >
                        {copiedShareUrl ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            {locale === 'pt-BR' ? 'Copiado!' : 'Copied!'}
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            {locale === 'pt-BR' ? 'Copiar URL' : 'Copy URL'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* JSON Export & Validated Import */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                    <h3 className="text-sm font-bold text-white">
                      {locale === 'pt-BR'
                        ? 'Exportar ou Importar Coleção JSON (Com Validação de Esquema)'
                        : 'Export or Import JSON Collection (Schema Validated)'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleExportJson}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white"
                      >
                        <FileJson className="w-4 h-4" />
                        {locale === 'pt-BR'
                          ? 'Exportar Coleção (.json)'
                          : 'Export Collection (.json)'}
                      </button>

                      <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer border border-slate-700">
                        <Upload className="w-4 h-4" />
                        {locale === 'pt-BR'
                          ? 'Selecionar Arquivo JSON para Importar...'
                          : 'Select JSON File to Import...'}
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={handleImportFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {importError && (
                      <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                        {importError}
                      </div>
                    )}

                    {importPreview && (
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2.5 text-xs">
                        <div className="font-bold text-cyan-300">
                          {locale === 'pt-BR'
                            ? 'Resumo de Validação do Arquivo Importado:'
                            : 'Imported File Validation Summary:'}
                        </div>
                        <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                          <li>
                            {locale === 'pt-BR' ? 'Favoritos válidos:' : 'Valid favorites:'}{' '}
                            {importPreview.parsedStore.favorites.length}
                          </li>
                          <li>
                            {locale === 'pt-BR' ? 'Vistas salvas válidas:' : 'Valid saved views:'}{' '}
                            {importPreview.parsedStore.savedViewpoints.length}
                          </li>
                          <li>
                            {locale === 'pt-BR' ? 'Notas do diário válidas:' : 'Valid journal notes:'}{' '}
                            {importPreview.parsedStore.journalEntries.length}
                          </li>
                        </ul>
                        {importPreview.warnings.length > 0 && (
                          <div className="text-amber-300 text-[11px]">
                            {importPreview.warnings.join(' ')}
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateStore(() => importPreview.parsedStore);
                              setImportPreview(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold"
                          >
                            {locale === 'pt-BR' ? 'Aplicar Importação' : 'Apply Import'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setImportPreview(null)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                          >
                            {locale === 'pt-BR' ? 'Cancelar' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

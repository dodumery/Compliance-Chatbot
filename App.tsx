
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Search, 
  Image as ImageIcon,
  ArrowRight,
  Loader2,
  Trash2,
  Edit3,
  Upload,
  Files,
  Settings,
  User as UserIcon,
  MessageSquare,
  History,
  Save,
  ChevronRight,
  ExternalLink,
  Lock,
  Unlock,
  Key,
  RefreshCw,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Eye,
  Layers
} from 'lucide-react';
import { GeminiService } from './services/geminiService';
import { AuditStatus, AuditReport, RegulationSource } from './types';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import { marked } from 'marked';

pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;

// marked options for security and table support
marked.setOptions({
  gfm: true,
  breaks: true,
});

const TrafficLight = ({ status }: { status: AuditStatus }) => {
  const colors = {
    [AuditStatus.COMPLIANT]: 'bg-green-500',
    [AuditStatus.VIOLATION]: 'bg-red-500',
    [AuditStatus.UNCERTAIN]: 'bg-yellow-500',
  };
  const labels = {
    [AuditStatus.COMPLIANT]: '적합 (Compliant)',
    [AuditStatus.VIOLATION]: '위반 (Violation)',
    [AuditStatus.UNCERTAIN]: '판단 불가 / 주의',
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
      <div className={`w-2 h-2 rounded-full ${colors[status]} animate-pulse`} />
      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter">
        {labels[status]}
      </span>
    </div>
  );
};

export default function App() {
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('user');
  const [activeTab, setActiveTab] = useState<'audit' | 'qa'>('audit');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmNewPw, setConfirmNewPw] = useState('');
  const [currentPwInput, setCurrentPwInput] = useState('');
  const [regSources, setRegSources] = useState<RegulationSource[]>([]);
  const [adminEditorContent, setAdminEditorContent] = useState('');
  const [adminEditorName, setAdminEditorName] = useState('수동 입력 규정');
  const [scenario, setScenario] = useState('');
  const [qaInput, setQaInput] = useState('');
  const [qaResponse, setQaResponse] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [useSearch, setUseSearch] = useState(false);
  const [evidenceImage, setEvidenceImage] = useState<string | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const geminiRef = useRef(new GeminiService());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ADMIN_ID = 'kidari';

  const toggleAdminView = useCallback(() => {
    if (isAdminAuthenticated) {
      setViewMode(prev => prev === 'admin' ? 'user' : 'admin');
    } else {
      setShowLoginModal(true);
    }
  }, [isAdminAuthenticated]);

  const fullRegulationText = useMemo(() => {
    return regSources.map(s => `[SOURCE: ${s.name}]\n${s.content}\n`).join('\n---\n');
  }, [regSources]);

  useEffect(() => {
    const savedSources = localStorage.getItem('compliance_reg_sources');
    if (savedSources) {
      try {
        setRegSources(JSON.parse(savedSources));
      } catch (e) { console.error(e); }
    }
    if (!localStorage.getItem('admin_password')) {
      localStorage.setItem('admin_password', '0000');
    }
  }, []);

  const saveSourcesToDisk = (sources: RegulationSource[]) => {
    localStorage.setItem('compliance_reg_sources', JSON.stringify(sources));
    setSaveStatus('변경사항 저장됨');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const addManualRegulation = () => {
    if (!adminEditorContent.trim()) return;
    const newSource: RegulationSource = {
      id: crypto.randomUUID(),
      name: adminEditorName || '수동 입력 규정',
      type: 'text',
      content: adminEditorContent,
      timestamp: Date.now()
    };
    const updated = [...regSources, newSource];
    setRegSources(updated);
    saveSourcesToDisk(updated);
    setAdminEditorContent('');
    setAdminEditorName('수동 입력 규정');
  };

  const deleteSource = (id: string) => {
    if (!confirm('해당 규정 항목을 삭제하시겠습니까?')) return;
    const updated = regSources.filter(s => s.id !== id);
    setRegSources(updated);
    saveSourcesToDisk(updated);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPw = localStorage.getItem('admin_password') || '0000';
    if (loginId === ADMIN_ID && loginPw === storedPw) {
      setIsAdminAuthenticated(true);
      setShowLoginModal(false);
      setViewMode('admin');
      setLoginPw('');
    } else {
      setLoginError('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  const handleUpdatePassword = () => {
    const storedPw = localStorage.getItem('admin_password') || '0000';
    if (currentPwInput !== storedPw) return alert('현재 비밀번호 오류');
    if (newPw !== confirmNewPw) return alert('비밀번호 불일치');
    localStorage.setItem('admin_password', newPw);
    alert('변경 완료');
    setNewPw(''); setConfirmNewPw(''); setCurrentPwInput('');
  };

  const handleAudit = async () => {
    if (regSources.length === 0) return setError("규정 데이터를 등록해주세요.");
    if (!scenario.trim()) return setError("사안을 입력해주세요.");
    setError(null); setIsAuditing(true);
    try {
      const result = await geminiRef.current.runAudit(regSources, scenario, useSearch);
      setReport(result);
    } catch (err: any) { setError(err.message); }
    finally { setIsAuditing(false); }
  };

  const handleQA = async () => {
    if (regSources.length === 0) return setError("규정 데이터를 등록해주세요.");
    if (!qaInput.trim()) return;
    setError(null);
    setIsAnswering(true);
    setQaResponse(null);
    try {
      const response = await geminiRef.current.askQuestion(regSources, qaInput);
      setQaResponse(response);
    } catch (err: any) { setError(err.message); }
    finally { setIsAnswering(false); }
  };

  const parsePDFWithVision = async (arrayBuffer: ArrayBuffer): Promise<{ text: string, visual: string[] }> => {
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    let visualSnapshots: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as any[];
      items.sort((a, b) => (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4]));
      let lastY = -1;
      let pageText = `--- Page ${i} ---\n`;
      for (const item of items) {
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) pageText += '\n';
        pageText += item.str + ' ';
        lastY = item.transform[5];
      }
      fullText += pageText + '\n\n';
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        visualSnapshots.push(canvas.toDataURL('image/png', 0.8));
      }
      if (i >= 10) break;
    }
    return { text: fullText, visual: visualSnapshots };
  };

  const parseExcel = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = '';
    workbook.SheetNames.forEach(name => {
      fullText += `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}\n\n`;
    });
    return fullText;
  };

  const processFiles = async (files: FileList | File[]) => {
    setIsParsing(true); setError(null);
    const newSources: RegulationSource[] = [];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
          const reader = new FileReader();
          reader.onload = (e) => setEvidenceImage(e.target?.result as string);
          reader.readAsDataURL(file);
        } else {
          const ab = await file.arrayBuffer();
          let txt = '';
          let visual: string[] | undefined;
          if (ext === 'pdf') {
            const res = await parsePDFWithVision(ab);
            txt = res.text;
            visual = res.visual;
          } else if (['xlsx', 'xls', 'csv'].includes(ext || '')) txt = await parseExcel(ab);
          else if (ext === 'docx') txt = (await mammoth.extractRawText({ arrayBuffer: ab })).value;
          else txt = new TextDecoder().decode(ab);
          newSources.push({
            id: crypto.randomUUID(),
            name: file.name,
            type: ext || 'unknown',
            content: txt,
            visualContext: visual,
            timestamp: Date.now()
          });
        }
      }
      if (newSources.length > 0) {
        const updated = [...regSources, ...newSources];
        setRegSources(updated);
        saveSourcesToDisk(updated);
      }
    } catch (err: any) { setError(err.message); }
    finally { setIsParsing(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEditImage = async () => {
    if (!evidenceImage || !imagePrompt) return;
    setIsEditingImage(true);
    try {
      const newImage = await geminiRef.current.editImage(evidenceImage, imagePrompt);
      setEvidenceImage(newImage); setImagePrompt('');
    } catch (err: any) { alert(err.message); }
    finally { setIsEditingImage(false); }
  };

  // Helper to render Markdown to HTML safely
  const renderMarkdown = (md: string) => {
    try {
      return marked.parse(md);
    } catch (e) {
      return md.replace(/\n/g, '<br/>');
    }
  };

  return (
    <div 
      className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 transition-all duration-300 ${isDragging ? 'brightness-90' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) processFiles(e.dataTransfer.files); }}
    >
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-blue-900 p-8 text-white flex flex-col items-center gap-4">
              <Lock className="w-8 h-8" />
              <div className="text-center">
                <h2 className="text-2xl font-bold">Admin Login</h2>
                <p className="text-blue-200 text-sm mt-1">관리자 권한이 필요합니다</p>
              </div>
            </div>
            <form onSubmit={handleLogin} className="p-8 space-y-5">
              <input type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="ID" required />
              <input type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="PW" required />
              {loginError && <div className="text-red-500 text-xs text-center">{loginError}</div>}
              <button type="submit" className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl">로그인</button>
              <button type="button" onClick={() => setShowLoginModal(false)} className="w-full text-slate-400 text-xs">취소</button>
            </form>
          </div>
        </div>
      )}

      <header className="h-16 border-b bg-white flex items-center justify-between px-8 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-900 p-2 rounded-lg"><ShieldCheck className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-lg font-bold text-blue-900 leading-none">Compliance Guardian</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">Multimodal AI Audit System</p>
          </div>
        </div>
        <nav className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button onClick={() => setViewMode('user')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'user' ? 'bg-white shadow-sm text-blue-900' : 'text-slate-500'}`}><UserIcon className="w-4 h-4" /> 사용자</button>
          <button onClick={toggleAdminView} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'admin' ? 'bg-white shadow-sm text-blue-900' : 'text-slate-500'}`}>{isAdminAuthenticated ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />} 관리자</button>
        </nav>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 flex flex-col gap-6">
        {viewMode === 'admin' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
                <h3 className="flex items-center gap-2 text-slate-800 font-bold"><Edit3 className="w-5 h-5 text-blue-900" /> 규정 수동 추가</h3>
                <input type="text" placeholder="항목 이름" className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm outline-none" value={adminEditorName} onChange={(e) => setAdminEditorName(e.target.value)} />
                <textarea className="w-full h-[350px] p-5 bg-slate-50 border rounded-xl outline-none resize-none text-sm font-mono" placeholder="텍스트 입력..." value={adminEditorContent} onChange={(e) => setAdminEditorContent(e.target.value)} />
                <button onClick={addManualRegulation} className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl">항목 추가</button>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Files className="w-5 h-5 text-blue-500" /> 규정 DB 목록</h3>
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border flex items-center gap-2 font-bold"><Upload className="w-3 h-3" /> 파일 추가</button>
                  <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt" onChange={handleFileUpload} />
                </div>
                <div className="space-y-3">
                  {regSources.length === 0 ? <div className="text-center py-20 text-slate-300">등록된 규정 없음</div> : regSources.map((source) => (
                    <div key={source.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-xl border hover:bg-white transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${source.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>{source.type === 'pdf' ? <FileCode className="w-5 h-5" /> : <FileText className="w-5 h-5" />}</div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">{source.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-400">{new Date(source.timestamp).toLocaleDateString()}</p>
                            {source.visualContext && <span className="flex items-center gap-1 text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 font-bold uppercase tracking-tighter"><Layers className="w-2.5 h-2.5" /> Visual Data</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => deleteSource(source.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-blue-900 rounded-2xl p-6 text-white shadow-xl shadow-blue-900/20">
                <h3 className="font-bold mb-2 flex items-center gap-2"><Layers className="w-5 h-5" /> 시각적 데이터 활용 안내</h3>
                <p className="text-xs opacity-90 leading-relaxed">PDF 파일은 업로드 시 페이지별 레이아웃을 스캔합니다. AI는 이를 활용해 복잡한 **표(Table)**나 **도식**을 정확하게 해석합니다.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 self-start shadow-sm">
              <button onClick={() => setActiveTab('audit')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'audit' ? 'bg-blue-900 text-white shadow-lg' : 'text-slate-500'}`}><ShieldCheck className="w-4 h-4" /> 컴플라이언스 감사</button>
              <button onClick={() => setActiveTab('qa')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'qa' ? 'bg-blue-900 text-white shadow-lg' : 'text-slate-500'}`}><MessageSquare className="w-4 h-4" /> 규정 Q&A 및 해설</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                {activeTab === 'audit' ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-slate-800"><AlertTriangle className="w-5 h-5 text-amber-500" /> 감사 요청 사안</div>
                      <button onClick={() => setScenario('')} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 className="w-3 h-3" /> 비우기</button>
                    </div>
                    <textarea className="w-full h-48 p-5 bg-slate-50 border rounded-xl outline-none resize-none text-sm leading-relaxed" placeholder="사례를 입력하세요..." value={scenario} onChange={(e) => setScenario(e.target.value)} />
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2"><Search className="w-4 h-4 text-blue-600" /><span className="text-xs font-bold text-slate-700">웹 검색 활용 (Search Grounding)</span></div>
                      <input type="checkbox" checked={useSearch} onChange={(e) => setUseSearch(e.target.checked)} className="accent-blue-900" />
                    </div>
                    <button onClick={handleAudit} disabled={isAuditing} className="w-full bg-blue-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center gap-2 text-lg disabled:bg-slate-300">
                      {isAuditing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldCheck className="w-6 h-6" />} {isAuditing ? '시각 구조 및 표 분석 중...' : 'Audit Now'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <div className="flex items-center gap-2 font-bold text-slate-800"><MessageSquare className="w-5 h-5 text-blue-500" /> 규정 궁금증 해결</div>
                    <textarea className="w-full h-48 p-5 bg-slate-50 border rounded-xl outline-none resize-none text-sm" placeholder="궁금한 사항을 입력하세요..." value={qaInput} onChange={(e) => setQaInput(e.target.value)} />
                    <button onClick={handleQA} disabled={isAnswering} className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center gap-2">
                      {isAnswering ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                      질문하기
                    </button>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col min-h-[600px] overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    {activeTab === 'audit' ? <History className="w-5 h-5 text-blue-600" /> : <MessageSquare className="w-5 h-5 text-blue-600" />} 
                    결과 리포트
                  </div>
                  {activeTab === 'audit' && report && <TrafficLight status={report.status} />}
                </div>
                <div className="flex-1 p-8 overflow-y-auto bg-white">
                  {/* 감사 결과 출력 */}
                  {activeTab === 'audit' && (
                    <>
                      {report ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
                          <div className="markdown-content prose max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(report.rawMarkdown) }} />
                          {report.groundingUrls && report.groundingUrls.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-slate-100">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Search className="w-3 h-3" /> Source References
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {report.groundingUrls.map((url, i) => (
                                  <a key={i} href={url.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                                    {url.title} <ExternalLink className="w-3 h-3" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : isAuditing ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6 opacity-40">
                          <div className="relative">
                            <Loader2 className="w-16 h-16 animate-spin text-blue-900" />
                            <Layers className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" />
                          </div>
                          <p className="text-sm font-bold text-blue-900 animate-pulse tracking-tighter">문서 시각 구조 및 데이터 표 교차 검증 중...</p>
                        </div>
                      ) : <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4"><ShieldCheck className="w-16 h-16 opacity-10" /><p className="text-sm font-medium">분석을 시작하세요.</p></div>}
                    </>
                  )}

                  {/* Q&A 답변 출력 */}
                  {activeTab === 'qa' && (
                    <>
                      {qaResponse ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
                          <div className="markdown-content prose max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(qaResponse) }} />
                        </div>
                      ) : isAnswering ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6 opacity-40">
                          <div className="relative">
                            <Loader2 className="w-16 h-16 animate-spin text-blue-900" />
                            <MessageSquare className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" />
                          </div>
                          <p className="text-sm font-bold text-blue-900 animate-pulse tracking-tighter">규정 해설 답변을 생성 중입니다...</p>
                        </div>
                      ) : <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4"><MessageSquare className="w-16 h-16 opacity-10" /><p className="text-sm font-medium">궁금한 점을 질문해 보세요.</p></div>}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="h-10 border-t bg-white px-8 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <div className="flex items-center gap-4"><span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> System Multimodal Active</span></div>
        <span className="uppercase tracking-widest">© 2025 Compliance Guardian Multimodal AI</span>
      </footer>
      
      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 p-4 bg-red-900 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-8">
          <Info className="w-5 h-5" />
          <span className="text-sm font-bold">{error}</span>
          <button onClick={() => setError(null)} className="ml-4 opacity-50 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  );
}

import {
  Video,
  Wifi,
  ShieldCheck,
  Cable,
  MapPin,
  CircleDashed,
  Fence,
} from "lucide-react";

export default function CorralCamera() {
  return (
    <div className="corral-page">
      <section className="card corral-view">
        <div className="card-heading">
          <div>
            <span className="section-eyebrow">
              UM NOVO OLHAR SOBRE A CALUMBI
            </span>
            <h2>Câmera do curral</h2>
          </div>
          <span className="camera-status">
            <CircleDashed size={13} /> Aguardando instalação
          </span>
        </div>
        <div className="camera-preview">
          <div className="camera-preview-top">
            <span>
              <MapPin size={13} /> CURRAL · FAZENDA CALUMBI
            </span>
            <span>SEM TRANSMISSÃO</span>
          </div>
          <div className="camera-preview-center">
            <span className="camera-placeholder-icon">
              <Video size={34} strokeWidth={1.3} />
            </span>
            <h2>Mais perto, mesmo de longe.</h2>
            <p>
              Um espaço reservado para acompanhar o curral da Calumbi quando a
              câmera estiver instalada.
            </p>
            <span className="camera-coming">
              <span /> Em breve na sua fazenda
            </span>
          </div>
          <div className="camera-fence" aria-hidden="true">
            <Fence size={140} strokeWidth={0.6} />
            <Fence size={140} strokeWidth={0.6} />
            <Fence size={140} strokeWidth={0.6} />
          </div>
          <span className="camera-preview-bottom">
            A câmera ainda não está conectada. Nenhuma imagem está sendo
            capturada.
          </span>
        </div>
        <div className="camera-caption">
          <ShieldCheck size={16} />
          <span>
            Esta página usa o mesmo acesso privado do restante da fazenda.
          </span>
        </div>
      </section>
      <section className="card camera-plan">
        <div className="card-heading">
          <div>
            <span className="section-eyebrow">
              PREPARAR HOJE, ACOMPANHAR AMANHÃ
            </span>
            <h2>O próximo passo para conectar.</h2>
          </div>
        </div>
        <div className="camera-plan-grid">
          <div>
            <span className="camera-plan-icon">
              <Video size={20} />
            </span>
            <small>01 · EQUIPAMENTO</small>
            <h3>Uma câmera no curral</h3>
            <p>
              Quando o equipamento for escolhido, definiremos a forma de
              integrar as imagens ao aplicativo.
            </p>
          </div>
          <div>
            <span className="camera-plan-icon">
              <Wifi size={20} />
            </span>
            <small>02 · CONECTIVIDADE</small>
            <h3>Internet na propriedade</h3>
            <p>
              A transmissão dependerá de energia e de uma conexão estável no
              local de instalação.
            </p>
          </div>
          <div>
            <span className="camera-plan-icon">
              <Cable size={20} />
            </span>
            <small>03 · INTEGRAÇÃO</small>
            <h3>Transmissão com acesso privado</h3>
            <p>
              A integração será feita após confirmar o modelo da câmera e o
              serviço de transmissão, mantendo as credenciais no servidor.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

import MainRouter from "./routes/route";
import { LanguageProvider } from './features/localization/LanguageProvider';

function App() {
  return (
    <LanguageProvider>
      <MainRouter />
    </LanguageProvider>
  );
}

export default App;

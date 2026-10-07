import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { SignIn, SignOut } from "./pages/Auth";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Trainings from "./pages/Trainings";
import TrainingPlayer from "./pages/TrainingPlayer";
import Certificate from "./pages/Certificate";
import Documents from "./pages/Documents";
import { ResourceDetail, Resources } from "./pages/Resources";
import Events from "./pages/Events";
import { Forum, Topic } from "./pages/Forum";
import Notices from "./pages/Notices";
import CalendarPage from "./pages/Calendar";
import LegalPage from "./pages/Legal";
import Materials from "./pages/Materials";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Seo from "./components/Seo";

export default function App() {
  return (
    <Layout>
      <Seo />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/najava" element={<SignIn />} />
        <Route path="/odjava" element={<SignOut />} />
        <Route path="/obuki" element={<Trainings />} />
        <Route path="/obuki/:trainingId/sertifikat" element={<Certificate />} />
        <Route path="/obuki/:trainingId" element={<TrainingPlayer />} />
        <Route path="/resursi" element={<Resources />} />
        <Route path="/resursi/:resourceId" element={<ResourceDetail />} />
        <Route path="/nastani" element={<Events />} />
        <Route path="/dokumenti" element={<Documents />} />
        <Route path="/forum" element={<Forum />} />
        <Route path="/forum/:topicId" element={<Topic />} />
        <Route path="/oglasi" element={<Notices />} />
        <Route path="/kalendar" element={<CalendarPage />} />
        <Route path="/materijali" element={<Materials />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/objavi" element={<Navigate to="/obuki" replace />} />
        <Route path="/privatnost" element={<LegalPage path="/privatnost" />} />
        <Route path="/uslovi" element={<LegalPage path="/uslovi" />} />
        <Route path="/kolacinja" element={<LegalPage path="/kolacinja" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

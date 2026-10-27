import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { SignIn, SignOut } from "./pages/Auth";
import Home from "./pages/Home";
import LegalPage from "./pages/Legal";
import NotFound from "./pages/NotFound";
import Seo from "./components/Seo";

const Profile = lazy(() => import("./pages/Profile"));
const Trainings = lazy(() => import("./pages/Trainings"));
const TrainingPlayer = lazy(() => import("./pages/TrainingPlayer"));
const Certificate = lazy(() => import("./pages/Certificate"));
const Documents = lazy(() => import("./pages/Documents"));
const Resources = lazy(() => import("./pages/Resources").then((mod) => ({ default: mod.Resources })));
const ResourceDetail = lazy(() => import("./pages/Resources").then((mod) => ({ default: mod.ResourceDetail })));
const Events = lazy(() => import("./pages/Events"));
const Forum = lazy(() => import("./pages/Forum").then((mod) => ({ default: mod.Forum })));
const Topic = lazy(() => import("./pages/Forum").then((mod) => ({ default: mod.Topic })));
const Notices = lazy(() => import("./pages/Notices"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const Admin = lazy(() => import("./pages/Admin"));

export default function App() {
  return (
    <Layout>
      <Seo />
      <Suspense fallback={<section className="panel">Се вчитува...</section>}>
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
        <Route path="/admin" element={<Admin />} />
        <Route path="/objavi" element={<Navigate to="/obuki" replace />} />
        <Route path="/privatnost" element={<LegalPage path="/privatnost" />} />
        <Route path="/uslovi" element={<LegalPage path="/uslovi" />} />
        <Route path="/kolacinja" element={<LegalPage path="/kolacinja" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </Layout>
  );
}

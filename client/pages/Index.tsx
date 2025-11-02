import Chatbot from "@/components/Chatbot";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Chatbot />
      </div>
    </div>
  );
}

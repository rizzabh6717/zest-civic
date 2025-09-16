import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function UserTypeSelector() {
  const navigate = useNavigate();
  const { setUserType } = useWeb3();

  const handleUserTypeSelect = (type: 'citizen' | 'worker' | 'dao') => {
    setUserType(type);
    navigate(`/${type}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light text-white mb-4">Choose Your Role</h1>
          <p className="text-white/70 text-lg">Select how you'd like to participate in the civic platform</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer" 
                onClick={() => handleUserTypeSelect('citizen')}>
            <CardHeader>
              <CardTitle className="text-white">Citizen</CardTitle>
              <CardDescription className="text-white/70">
                Submit grievances, vote on community priorities, and engage in civic activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="hero" className="w-full">
                Join as Citizen
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => handleUserTypeSelect('worker')}>
            <CardHeader>
              <CardTitle className="text-white">Worker</CardTitle>
              <CardDescription className="text-white/70">
                Take on community tasks, build reputation, and earn rewards for your contributions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="hero" className="w-full">
                Join as Worker
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => handleUserTypeSelect('dao')}>
            <CardHeader>
              <CardTitle className="text-white">DAO Member</CardTitle>
              <CardDescription className="text-white/70">
                Participate in governance, manage proposals, and guide the community direction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="hero" className="w-full">
                Join as DAO Member
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
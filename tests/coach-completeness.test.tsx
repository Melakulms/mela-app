import { beforeEach,afterEach,it,expect,vi } from 'vitest'
import { cleanup,render,screen,fireEvent,waitFor } from '@testing-library/react'
import AiCareerCoach from '../src/pages/AiCareerCoach'
import { readCoachHistory,saveCoachHistory,clearCoachHistories } from '../src/lib/coach-history'
import { I18nProvider,translate } from '../src/i18n'
const mocks=vi.hoisted(()=>({ask:vi.fn()}))
vi.mock('../src/lib/coach',()=>({askCareerCoach:mocks.ask}))
beforeEach(()=>{vi.resetAllMocks();sessionStorage.clear();localStorage.removeItem('mela_language')})
afterEach(()=>{cleanup();sessionStorage.clear();localStorage.removeItem('mela_language')})
it('restores account-scoped conversation and a draft after navigation',()=>{
 saveCoachHistory('learner-a',[{role:'user',text:'I enjoy mathematics.'},{role:'coach',text:'Explore quantitative skills.'}],'How do I start?')
 const view=render(<AiCareerCoach userId="learner-a" onBack={vi.fn()}/>);
 expect(screen.getByText('Explore quantitative skills.')).toBeTruthy();expect((screen.getByLabelText('Question for your career coach') as HTMLInputElement).value).toBe('How do I start?')
 view.unmount();render(<AiCareerCoach userId="learner-b" onBack={vi.fn()}/>);
 expect(screen.queryByText('Explore quantitative skills.')).toBeNull();expect((screen.getByLabelText('Question for your career coach') as HTMLInputElement).value).toBe('')
})
it('sends follow-up context once and retains it after a failed request',async()=>{
 saveCoachHistory('a',[{role:'user',text:'I like numbers.'},{role:'coach',text:'Try statistics.'}],'What next?')
 mocks.ask.mockResolvedValueOnce({kind:'error',message:'Network unavailable'}).mockResolvedValueOnce({kind:'reply',reply:{response:'Practice interpreting data.'}})
 render(<AiCareerCoach userId="a" onBack={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Send'}));await screen.findByRole('alert');
 expect((screen.getByLabelText('Question for your career coach') as HTMLInputElement).value).toBe('What next?');
 fireEvent.click(screen.getByRole('button',{name:'Send'}));fireEvent.click(screen.getByRole('button',{name:'Send'}));
 await screen.findByText('Practice interpreting data.');expect(mocks.ask).toHaveBeenCalledTimes(2);expect(mocks.ask).toHaveBeenLastCalledWith('What next?',[{role:'user',text:'I like numbers.'},{role:'coach',text:'Try statistics.'}],'en');
 await waitFor(()=>expect(readCoachHistory('a').turns).toHaveLength(4));
 fireEvent.click(screen.getByRole('button',{name:'Clear conversation'}));await waitFor(()=>expect(readCoachHistory('a').turns).toHaveLength(0));
})
it('localizes coach controls and passes the chosen language',async()=>{
 localStorage.setItem('mela_language','am');mocks.ask.mockResolvedValue({kind:'reply',reply:{response:'መልስ'}})
 render(<I18nProvider><AiCareerCoach onBack={vi.fn()}/></I18nProvider>);
 fireEvent.change(screen.getByLabelText(translate('am','coachQuestion')),{target:{value:'ጥያቄ'}});
 fireEvent.click(screen.getByRole('button',{name:translate('am','coachSend')}));await screen.findByText('መልስ');expect(mocks.ask).toHaveBeenCalledWith('ጥያቄ',[],'am')
})
it('expires old history and clears all coach data on sign-out',()=>{
 sessionStorage.setItem('mela_coach_v1:a',JSON.stringify({savedAt:Date.now()-31*60000,turns:[{role:'coach',text:'Old answer'}],input:'Old draft'}));expect(readCoachHistory('a').turns).toEqual([])
 saveCoachHistory('b',[],'Draft');sessionStorage.setItem('unrelated','keep');clearCoachHistories();expect(sessionStorage.getItem('mela_coach_v1:b')).toBeNull();expect(sessionStorage.getItem('unrelated')).toBe('keep')
})
it('keeps conversation usable when tab storage is blocked',()=>{
 const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked')});
 expect(()=>saveCoachHistory('a',[],'Draft')).not.toThrow();spy.mockRestore()
})

// Compatibility shim: lets the rest of the app keep importing icon names from
// "lucide-react" while actually rendering Phosphor icons. Saves the user from
// renaming every import. Phosphor's <Icon /> accepts the same className / size
// / color props we already pass everywhere; the visual weight defaults to
// "regular", which is the closest equivalent to Lucide's default stroke.
import * as Phosphor from "@phosphor-icons/react";

const ICONS = {
  AlertCircle: Phosphor.WarningCircle,
  ArrowLeft: Phosphor.ArrowLeft,
  ArrowRight: Phosphor.ArrowRight,
  ArrowRightIcon: Phosphor.ArrowRight,
  ArrowUpDown: Phosphor.ArrowsDownUp,
  ArrowUpRight: Phosphor.ArrowUpRight,
  AtSign: Phosphor.At,
  AtSignIcon: Phosphor.At,
  BarChart3: Phosphor.ChartBar,
  Bell: Phosphor.Bell,
  BellIcon: Phosphor.Bell,
  BookMarked: Phosphor.BookBookmark,
  Bookmark: Phosphor.Bookmark,
  BookOpen: Phosphor.BookOpen,
  BookOpenIcon: Phosphor.BookOpen,
  Calendar: Phosphor.CalendarBlank,
  CalendarBlank: Phosphor.CalendarBlank,
  CalendarDays: Phosphor.Calendar,
  Camera: Phosphor.Camera,
  CaretLeft: Phosphor.CaretLeft,
  CaretRight: Phosphor.CaretRight,
  Check: Phosphor.Check,
  CheckCircle: Phosphor.CheckCircle,
  ChartLine: Phosphor.ChartLine,
  ChatCircle: Phosphor.ChatCircle,
  CheckCircle2: Phosphor.CheckCircle,
  CheckCircleIcon: Phosphor.CheckCircle,
  CheckIcon: Phosphor.Check,
  ChevronDown: Phosphor.CaretDown,
  ChevronLeft: Phosphor.CaretLeft,
  ChevronLeftIcon: Phosphor.CaretLeft,
  ChevronRight: Phosphor.CaretRight,
  ChevronRightIcon: Phosphor.CaretRight,
  ChevronUp: Phosphor.CaretUp,
  CircleCheck: Phosphor.CheckCircle,
  Clock: Phosphor.Clock,
  Compass: Phosphor.Compass,
  CompassIcon: Phosphor.Compass,
  CreditCard: Phosphor.CreditCard,
  CreditCardIcon: Phosphor.CreditCard,
  Crown: Phosphor.Crown,
  Edit3: Phosphor.PencilSimpleLine,
  Eye: Phosphor.Eye,
  Feather: Phosphor.Feather,
  FolderOpen: Phosphor.FolderOpen,
  Folder: Phosphor.Folder,
  MagnifyingGlass: Phosphor.MagnifyingGlass,
  Globe: Phosphor.Globe,
  GraduationCap: Phosphor.GraduationCap,
  Hand: Phosphor.Hand,
  Hash: Phosphor.Hash,
  HelpCircleIcon: Phosphor.Question,
  Heart: Phosphor.Heart,
  Home: Phosphor.House,
  HomeIcon: Phosphor.House,
  Image: Phosphor.Image,
  Info: Phosphor.Info,
  InstagramLogo: Phosphor.InstagramLogo,
  Keyboard: Phosphor.Keyboard,
  LayoutGrid: Phosphor.SquaresFour,
  Library: Phosphor.Books,
  Lightbulb: Phosphor.Lightbulb,
  LightbulbIcon: Phosphor.Lightbulb,
  Loader2: Phosphor.CircleNotch,
  Lock: Phosphor.Lock,
  LockIcon: Phosphor.Lock,
  LogIn: Phosphor.SignIn,
  LogOut: Phosphor.SignOut,
  Mail: Phosphor.EnvelopeSimple,
  MapPin: Phosphor.MapPin,
  Maximize2: Phosphor.CornersOut,
  Medal: Phosphor.Medal,
  Phone: Phosphor.Phone,
  Menu: Phosphor.List,
  MenuIcon: Phosphor.List,
  MessageCircle: Phosphor.ChatCircle,
  MessageSquare: Phosphor.ChatTeardrop,
  MessagesSquare: Phosphor.ChatsCircle,
  Monitor: Phosphor.Monitor,
  Minus: Phosphor.Minus,
  Moon: Phosphor.Moon,
  MoonIcon: Phosphor.Moon,
  MoreHorizontal: Phosphor.DotsThree,
  MoreHorizontalIcon: Phosphor.DotsThree,
  MousePointerClick: Phosphor.MouseSimple,
  NotebookPen: Phosphor.Notebook,
  PanelLeftIcon: Phosphor.Sidebar,
  PenLine: Phosphor.PencilLine,
  PixLogo: Phosphor.PixLogo,
  Plus: Phosphor.Plus,
  QrCode: Phosphor.QrCode,
  QuoteIcon: Phosphor.Quotes,
  RefreshCw: Phosphor.ArrowsClockwise,
  Search: Phosphor.MagnifyingGlass,
  SealCheck: Phosphor.SealCheck,
  Send: Phosphor.PaperPlaneTilt,
  Settings: Phosphor.Gear,
  SettingsIcon: Phosphor.Gear,
  Share2: Phosphor.ShareNetwork,
  Shield: Phosphor.Shield,
  ShieldAlert: Phosphor.ShieldWarning,
  ShieldIcon: Phosphor.Shield,
  SlidersHorizontal: Phosphor.SlidersHorizontal,
  Smartphone: Phosphor.DeviceMobile,
  Smile: Phosphor.Smiley,
  SmilePlus: Phosphor.Smiley,
  Sparkles: Phosphor.Sparkle,
  StarIcon: Phosphor.Star,
  Sun: Phosphor.Sun,
  SunIcon: Phosphor.Sun,
  Trash2: Phosphor.Trash,
  Trophy: Phosphor.Trophy,
  Flame: Phosphor.Flame,
  Gift: Phosphor.Gift,
  Layers: Phosphor.Stack,
  ShieldCheck: Phosphor.ShieldCheck,
  Truck: Phosphor.Truck,
  Shirt: Phosphor.TShirt,
  Award: Phosphor.Medal,
  User: Phosphor.User,
  UserCheck: Phosphor.UserCheck,
  UserCircle: Phosphor.UserCircle,
  UserIcon: Phosphor.User,
  UserPlus: Phosphor.UserPlus,
  UserRound: Phosphor.UserCircle,
  Users: Phosphor.Users,
  Wallet: Phosphor.Wallet,
  Warning: Phosphor.Warning,
  WhatsappLogo: Phosphor.WhatsappLogo,
  WifiOff: Phosphor.WifiSlash,
  X: Phosphor.X,
  XIcon: Phosphor.X,
};

export function Icon({ name, ...props }) {
  const Component = ICONS[name] || Phosphor.Question;
  return <Component weight="regular" {...props} />;
}

export const AlertCircle = Phosphor.WarningCircle;
export const ArrowLeft = Phosphor.ArrowLeft;
export const ArrowRight = Phosphor.ArrowRight;
export const ArrowRightIcon = Phosphor.ArrowRight;
export const ArrowUpDown = Phosphor.ArrowsDownUp;
export const ArrowUpRight = Phosphor.ArrowUpRight;
export const AtSign = Phosphor.At;
export const AtSignIcon = Phosphor.At;
export const Award = Phosphor.Medal;
export const BarChart3 = Phosphor.ChartBar;
export const Bell = Phosphor.Bell;
export const BellIcon = Phosphor.Bell;
export const BookMarked = Phosphor.BookBookmark;
export const Bookmark = Phosphor.Bookmark;
export const BookOpen = Phosphor.BookOpen;
export const BookOpenIcon = Phosphor.BookOpen;
export const Calendar = Phosphor.CalendarBlank;
export const CalendarBlank = Phosphor.CalendarBlank;
export const CalendarDays = Phosphor.Calendar;
export const Camera = Phosphor.Camera;
export const CaretLeft = Phosphor.CaretLeft;
export const CaretRight = Phosphor.CaretRight;
export const Check = Phosphor.Check;
export const CheckCircle = Phosphor.CheckCircle;
export const ChartLine = Phosphor.ChartLine;
export const ChatCircle = Phosphor.ChatCircle;
export const CheckCircle2 = Phosphor.CheckCircle;
export const CheckCircleIcon = Phosphor.CheckCircle;
export const CheckIcon = Phosphor.Check;
export const ChevronDown = Phosphor.CaretDown;
export const ChevronLeft = Phosphor.CaretLeft;
export const ChevronLeftIcon = Phosphor.CaretLeft;
export const ChevronRight = Phosphor.CaretRight;
export const ChevronRightIcon = Phosphor.CaretRight;
export const ChevronUp = Phosphor.CaretUp;
export const CircleCheck = Phosphor.CheckCircle;
export const Clock = Phosphor.Clock;
export const Compass = Phosphor.Compass;
export const CompassIcon = Phosphor.Compass;
export const CreditCard = Phosphor.CreditCard;
export const CreditCardIcon = Phosphor.CreditCard;
export const Crown = Phosphor.Crown;
export const Copy = Phosphor.Copy;
export const Edit3 = Phosphor.PencilSimpleLine;
export const Eye = Phosphor.Eye;
export const Feather = Phosphor.Feather;
export const Flame = Phosphor.Flame;
export const Flag = Phosphor.Flag;
export const FolderOpen = Phosphor.FolderOpen;
export const Folder = Phosphor.Folder;
export const Gift = Phosphor.Gift;
export const GiftIcon = Phosphor.Gift;
export const MagnifyingGlass = Phosphor.MagnifyingGlass;
export const Globe = Phosphor.Globe;
export const GraduationCap = Phosphor.GraduationCap;
export const Hand = Phosphor.Hand;
export const Hash = Phosphor.Hash;
export const HelpCircleIcon = Phosphor.Question;
export const Heart = Phosphor.Heart;
export const Home = Phosphor.House;
export const HomeIcon = Phosphor.House;
export const Image = Phosphor.Image;
export const Info = Phosphor.Info;
export const InstagramLogo = Phosphor.InstagramLogo;
export const Keyboard = Phosphor.Keyboard;
export const Layers = Phosphor.Stack;
export const LayoutGrid = Phosphor.SquaresFour;
export const Library = Phosphor.Books;
export const Lightbulb = Phosphor.Lightbulb;
export const LightbulbIcon = Phosphor.Lightbulb;
export const Loader2 = Phosphor.CircleNotch;
export const Lock = Phosphor.Lock;
export const LockIcon = Phosphor.Lock;
export const LogIn = Phosphor.SignIn;
export const LogOut = Phosphor.SignOut;
export const Mail = Phosphor.EnvelopeSimple;
export const Maximize2 = Phosphor.CornersOut;
export const Minimize2 = Phosphor.CornersIn;
export const Menu = Phosphor.List;
export const MenuIcon = Phosphor.List;
export const MessageCircle = Phosphor.ChatCircle;
export const MessageSquare = Phosphor.ChatTeardrop;
export const MessagesSquare = Phosphor.ChatsCircle;
export const Monitor = Phosphor.Monitor;
export const Minus = Phosphor.Minus;
export const Moon = Phosphor.Moon;
export const MoonIcon = Phosphor.Moon;
export const MoreHorizontal = Phosphor.DotsThree;
export const MoreHorizontalIcon = Phosphor.DotsThree;
export const MousePointerClick = Phosphor.MouseSimple;
export const NotebookPen = Phosphor.Notebook;
export const PanelLeftIcon = Phosphor.Sidebar;
export const PenLine = Phosphor.PencilLine;
export const PixLogo = Phosphor.PixLogo;
export const Plus = Phosphor.Plus;
export const QrCode = Phosphor.QrCode;
export const QuoteIcon = Phosphor.Quotes;
export const RefreshCw = Phosphor.ArrowsClockwise;
export const Search = Phosphor.MagnifyingGlass;
export const SealCheck = Phosphor.SealCheck;
export const Send = Phosphor.PaperPlaneTilt;
export const Settings = Phosphor.Gear;
export const SettingsIcon = Phosphor.Gear;
export const Share2 = Phosphor.ShareNetwork;
export const Shield = Phosphor.Shield;
export const ShieldAlert = Phosphor.ShieldWarning;
export const ShieldCheck = Phosphor.ShieldCheck;
export const ShieldIcon = Phosphor.Shield;
export const Shirt = Phosphor.TShirt;
export const SlidersHorizontal = Phosphor.SlidersHorizontal;
export const Smartphone = Phosphor.DeviceMobile;
export const Smile = Phosphor.Smiley;
export const SmilePlus = Phosphor.Smiley;
export const Sparkles = Phosphor.Sparkle;
export const StarIcon = Phosphor.Star;
export const Sun = Phosphor.Sun;
export const SunIcon = Phosphor.Sun;
export const Storefront = Phosphor.Storefront;
export const Target = Phosphor.Crosshair;
export const Trash2 = Phosphor.Trash;
export const Trophy = Phosphor.Trophy;
export const Medal = Phosphor.Medal;
export const Truck = Phosphor.Truck;
export const Package = Phosphor.Package;
export const User = Phosphor.User;
export const UserCheck = Phosphor.UserCheck;
export const UserCircle = Phosphor.UserCircle;
export const UserIcon = Phosphor.User;
export const UserPlus = Phosphor.UserPlus;
export const UserRound = Phosphor.UserCircle;
export const Users = Phosphor.Users;
export const Wallet = Phosphor.Wallet;
export const Warning = Phosphor.Warning;
export const WhatsappLogo = Phosphor.WhatsappLogo;
export const WifiOff = Phosphor.WifiSlash;
export const X = Phosphor.X;
export const MapPin = Phosphor.MapPin;
export const Phone = Phosphor.Phone;
export const Coins = Phosphor.Coins;
export const XIcon = Phosphor.X;
